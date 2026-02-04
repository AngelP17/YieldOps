"""
Rust Scheduler Optimizer Wrapper

Provides a Python interface to the Rust constraint-based scheduler optimizer.
"""

import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import Rust module
_RUST_AVAILABLE = False
_rust_sched = None

try:
    import yieldops_scheduler as _rust_sched
    _RUST_AVAILABLE = True
    logger.info("Rust Scheduler module loaded successfully")
except ImportError as e:
    logger.info(f"Rust Scheduler not available: {e}")


def is_rust_available() -> bool:
    """Check if Rust Scheduler module is available."""
    return _RUST_AVAILABLE


@dataclass 
class SchedulerJob:
    """Job for scheduling."""
    job_id: str
    job_name: str
    priority_level: int  # 1=highest, 5=lowest
    wafer_count: int
    is_hot_lot: bool
    recipe_type: str
    deadline_hours: Optional[float] = None  # hours until deadline


@dataclass
class SchedulerMachine:
    """Machine for scheduling."""
    machine_id: str
    name: str
    machine_type: str  # lithography, etching, deposition, etc.
    status: str  # IDLE, RUNNING, DOWN, MAINTENANCE
    efficiency_rating: float
    current_queue_depth: int = 0
    estimated_available_hours: float = 0.0


@dataclass
class Assignment:
    """Single job-machine assignment."""
    job_id: str
    job_name: str
    machine_id: str
    machine_name: str
    score: float
    reason: str
    estimated_start_hours: float
    constraint_violations: List[str]


@dataclass
class OptimizationResult:
    """Overall optimization result."""
    assignments: List[Assignment]
    total_score: float
    unassigned_jobs: List[str]
    optimization_time_ms: float


@dataclass
class ConstraintConfig:
    """Constraint configuration for optimizer."""
    enforce_recipe_match: bool = True
    enforce_deadlines: bool = False
    priority_weight: float = 0.3
    efficiency_weight: float = 0.3
    deadline_weight: float = 0.2
    queue_depth_weight: float = 0.2


class SchedulerOptimizer:
    """
    Constraint-based scheduler optimizer.
    
    Uses Rust backend when available for performance.
    Falls back to a simple Python implementation otherwise.
    """
    
    def __init__(self, config: Optional[ConstraintConfig] = None, use_rust: bool = True):
        self.config = config or ConstraintConfig()
        self.use_rust = use_rust and _RUST_AVAILABLE
        
        if self.use_rust and _rust_sched is not None:
            rust_config = _rust_sched.ConstraintConfig(
                self.config.enforce_recipe_match,
                self.config.enforce_deadlines,
                self.config.priority_weight,
                self.config.efficiency_weight,
                self.config.deadline_weight,
                self.config.queue_depth_weight
            )
            self._rust_optimizer = _rust_sched.SchedulerOptimizer(rust_config)
        else:
            self._rust_optimizer = None
    
    @property
    def backend(self) -> str:
        """Return the current backend being used."""
        return "rust" if self.use_rust and self._rust_optimizer else "python"
    
    def optimize(
        self,
        jobs: List[SchedulerJob],
        machines: List[SchedulerMachine],
        max_assignments: int = 10
    ) -> OptimizationResult:
        """
        Optimize job assignments to machines.
        
        Args:
            jobs: Jobs to schedule
            machines: Available machines
            max_assignments: Maximum number of assignments to make
        
        Returns:
            OptimizationResult with assignments
        """
        if self.use_rust and self._rust_optimizer is not None:
            return self._optimize_rust(jobs, machines, max_assignments)
        else:
            return self._optimize_python(jobs, machines, max_assignments)
    
    def _optimize_rust(
        self,
        jobs: List[SchedulerJob],
        machines: List[SchedulerMachine],
        max_assignments: int
    ) -> OptimizationResult:
        """Run optimization using Rust backend."""
        # Convert to Rust types
        rust_jobs = [
            _rust_sched.SchedulerJob(
                j.job_id,
                j.job_name,
                j.priority_level,
                j.wafer_count,
                j.is_hot_lot,
                j.recipe_type,
                j.deadline_hours
            )
            for j in jobs
        ]
        
        rust_machines = [
            _rust_sched.SchedulerMachine(
                m.machine_id,
                m.name,
                m.machine_type,
                m.status,
                m.efficiency_rating,
                m.current_queue_depth,
                m.estimated_available_hours
            )
            for m in machines
        ]
        
        # Run optimization
        result = self._rust_optimizer.optimize(rust_jobs, rust_machines, max_assignments)
        
        # Convert back to Python types
        assignments = [
            Assignment(
                job_id=a.job_id,
                job_name=a.job_name,
                machine_id=a.machine_id,
                machine_name=a.machine_name,
                score=a.score,
                reason=a.reason,
                estimated_start_hours=a.estimated_start_hours,
                constraint_violations=list(a.constraint_violations)
            )
            for a in result.assignments
        ]
        
        return OptimizationResult(
            assignments=assignments,
            total_score=result.total_score,
            unassigned_jobs=list(result.unassigned_jobs),
            optimization_time_ms=result.optimization_time_ms
        )
    
    def _optimize_python(
        self,
        jobs: List[SchedulerJob],
        machines: List[SchedulerMachine],
        max_assignments: int
    ) -> OptimizationResult:
        """Fallback Python optimization (simple greedy)."""
        import time
        start = time.time()
        
        # Sort jobs by priority
        sorted_jobs = sorted(
            jobs,
            key=lambda j: (not j.is_hot_lot, j.priority_level)
        )
        
        assignments = []
        unassigned = []
        assigned_machines = set()
        
        # Recipe compatibility mapping
        recipe_to_type = {
            "lithography": ["lithography"],
            "euv": ["lithography"],
            "duv": ["lithography"],
            "etching": ["etching"],
            "etch": ["etching"],
            "deposition": ["deposition"],
            "cvd": ["deposition"],
            "pvd": ["deposition"],
            "inspection": ["inspection"],
            "cleaning": ["cleaning"],
        }
        
        for job in sorted_jobs[:max_assignments]:
            best_machine = None
            best_score = -1.0
            
            compatible_types = recipe_to_type.get(
                job.recipe_type.lower(), 
                ["lithography", "etching", "deposition", "inspection", "cleaning"]
            )
            
            for machine in machines:
                if machine.machine_id in assigned_machines:
                    continue
                if machine.status not in ["IDLE", "RUNNING"]:
                    continue
                
                # Check recipe compatibility
                if self.config.enforce_recipe_match:
                    type_match = any(
                        t in machine.machine_type.lower() 
                        for t in compatible_types
                    )
                    if not type_match:
                        continue
                
                # Calculate score
                score = machine.efficiency_rating
                if machine.status == "IDLE":
                    score += 0.1
                
                if score > best_score:
                    best_score = score
                    best_machine = machine
            
            if best_machine:
                assignments.append(Assignment(
                    job_id=job.job_id,
                    job_name=job.job_name,
                    machine_id=best_machine.machine_id,
                    machine_name=best_machine.name,
                    score=best_score,
                    reason=f"Python fallback | Efficiency: {best_machine.efficiency_rating:.0%}",
                    estimated_start_hours=best_machine.estimated_available_hours,
                    constraint_violations=[]
                ))
                assigned_machines.add(best_machine.machine_id)
            else:
                unassigned.append(job.job_id)
        
        elapsed_ms = (time.time() - start) * 1000
        
        return OptimizationResult(
            assignments=assignments,
            total_score=sum(a.score for a in assignments),
            unassigned_jobs=unassigned,
            optimization_time_ms=elapsed_ms
        )


# Singleton instance
scheduler_optimizer = SchedulerOptimizer()
