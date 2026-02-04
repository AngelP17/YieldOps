"""
Rust Scheduler Wrapper

Provides a Python interface to the Rust constraint-based scheduler.
Falls back to the Python ToC engine if Rust is unavailable.
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
    logger.info(f"Rust Scheduler not available, using Python fallback: {e}")


def is_rust_available() -> bool:
    """Check if Rust Scheduler module is available."""
    return _RUST_AVAILABLE


@dataclass
class RustDispatchDecision:
    """Dispatch decision from Rust scheduler."""
    job_id: str
    machine_id: str
    machine_name: str
    reason: str
    score: float
    timestamp: datetime


class RustSchedulerOptimizer:
    """
    Wrapper class that integrates Rust scheduler with the ToC engine API.
    Uses Rust backend when available for optimized job-to-machine assignments.
    """
    
    def __init__(self, use_rust: bool = True):
        self.use_rust = use_rust and _RUST_AVAILABLE
        self.algorithm_version = "2.0.0-rust" if self.use_rust else "1.0.0-python"
        self.dispatch_count = 0
        
        if self.use_rust:
            self._optimizer = _rust_sched.SchedulerOptimizer()
            logger.info("Rust SchedulerOptimizer initialized")
        else:
            self._optimizer = None
    
    @property
    def backend(self) -> str:
        """Return the current backend being used."""
        return "rust" if self.use_rust else "python"
    
    def dispatch_batch(
        self,
        pending_jobs: List[Any],
        available_machines: List[Any],
        queue_depths: Optional[Dict[str, int]] = None,
        max_dispatches: int = 5
    ) -> List[RustDispatchDecision]:
        """
        Run optimized dispatch using Rust backend.
        
        Args:
            pending_jobs: List of pending jobs (Job dataclass or dict)
            available_machines: List of available machines
            queue_depths: Dict of machine_id -> current queue depth
            max_dispatches: Maximum number of dispatches to make
        
        Returns:
            List of dispatch decisions
        """
        if not self.use_rust or self._optimizer is None:
            raise RuntimeError("Rust backend not available")
        
        if queue_depths is None:
            queue_depths = {}
        
        # Convert jobs to Rust format
        rust_jobs = []
        for job in pending_jobs:
            job_id = getattr(job, 'job_id', job.get('job_id', 'unknown'))
            job_name = getattr(job, 'job_name', job.get('job_name', 'Unknown'))
            priority_level = getattr(job, 'priority_level', job.get('priority_level', 5))
            wafer_count = getattr(job, 'wafer_count', job.get('wafer_count', 0))
            is_hot_lot = getattr(job, 'is_hot_lot', job.get('is_hot_lot', False))
            recipe_type = getattr(job, 'recipe_type', job.get('recipe_type', 'unknown'))
            
            rust_jobs.append(
                _rust_sched.SchedulerJob(
                    job_id=job_id,
                    job_name=job_name,
                    priority_level=priority_level,
                    wafer_count=wafer_count,
                    is_hot_lot=is_hot_lot,
                    recipe_type=recipe_type,
                    deadline_hours=None
                )
            )
        
        # Convert machines to Rust format
        rust_machines = []
        for machine in available_machines:
            machine_id = getattr(machine, 'machine_id', machine.get('machine_id', 'unknown'))
            name = getattr(machine, 'name', machine.get('name', 'Unknown'))
            machine_type = getattr(machine, 'type', machine.get('type', 'unknown'))
            status = getattr(machine, 'status', machine.get('status', 'IDLE'))
            efficiency = getattr(machine, 'efficiency_rating', machine.get('efficiency_rating', 0.5))
            queue_depth = queue_depths.get(machine_id, 0)
            
            rust_machines.append(
                _rust_sched.SchedulerMachine(
                    machine_id=machine_id,
                    name=name,
                    machine_type=machine_type,
                    status=status,
                    efficiency_rating=efficiency,
                    current_queue_depth=queue_depth,
                    estimated_available_hours=0.0 if status == "IDLE" else 2.0
                )
            )
        
        # Run optimization
        result = self._optimizer.optimize(rust_jobs, rust_machines, max_dispatches)
        
        # Convert results back to Python
        decisions = []
        for assignment in result.assignments:
            decision = RustDispatchDecision(
                job_id=assignment.job_id,
                machine_id=assignment.machine_id,
                machine_name=assignment.machine_name,
                reason=assignment.reason,
                score=assignment.score,
                timestamp=datetime.utcnow()
            )
            decisions.append(decision)
            self.dispatch_count += 1
        
        return decisions
    
    def get_algorithm_info(self) -> Dict[str, Any]:
        """Get information about the scheduler algorithm."""
        return {
            "version": self.algorithm_version,
            "backend": self.backend,
            "name": "Constraint-Based Scheduler" if self.use_rust else "Theory of Constraints Dispatch",
            "description": (
                "Multi-objective optimization with constraint satisfaction"
                if self.use_rust else "Goldratt's Theory of Constraints for job dispatch"
            ),
            "features": [
                "Hot lot prioritization",
                "Recipe compatibility matching",
                "Efficiency scoring",
                "Queue depth optimization"
            ] + (["Constraint satisfaction", "Multi-objective scoring"] if self.use_rust else []),
            "total_dispatches": self.dispatch_count
        }


# Singleton instance
rust_scheduler = RustSchedulerOptimizer(use_rust=_RUST_AVAILABLE)
