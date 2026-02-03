"""
Theory of Constraints (ToC) Dispatch Algorithm

Priority Rules:
1. Hot Lots (is_hot_lot=True) always first
2. Priority level (1=highest, 5=lowest)
3. FIFO within same priority

Machine Selection:
1. Highest efficiency rating
2. IDLE status preferred
3. Lowest queue depth
"""

from typing import List, Optional, Dict
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class Machine:
    machine_id: str
    name: str
    status: str
    efficiency_rating: float
    type: str
    current_wafer_count: int = 0


@dataclass
class Job:
    job_id: str
    job_name: str
    priority_level: int
    wafer_count: int
    is_hot_lot: bool
    recipe_type: str
    created_at: datetime
    status: str = "PENDING"


@dataclass
class DispatchDecision:
    job_id: str
    machine_id: str
    reason: str
    timestamp: datetime


class TheoryOfConstraintsEngine:
    """
    Implements Goldratt's Theory of Constraints for job dispatch.
    
    Key Concepts:
    - Bottleneck: The constraint limiting system throughput
    - Drum-Buffer-Rope: Schedule based on bottleneck capacity
    - Hot Lots: VIP jobs that bypass normal queueing
    """
    
    def __init__(self):
        self.dispatch_count = 0
        self.algorithm_version = "1.0.0"
    
    def calculate_machine_score(
        self, 
        machine: Machine, 
        job: Job,
        queue_depth: int = 0
    ) -> float:
        """
        Calculate suitability score for machine-job pairing.
        
        Score = efficiency_rating * status_multiplier * load_factor
        
        Higher score = better match
        """
        # Base efficiency (0.0 - 1.0)
        score = machine.efficiency_rating
        
        # Status multiplier
        status_multipliers = {
            "IDLE": 1.0,
            "RUNNING": 0.7,
            "MAINTENANCE": 0.0,
            "DOWN": 0.0
        }
        score *= status_multipliers.get(machine.status, 0.0)
        
        # Load factor (prefer less loaded machines)
        load_factor = 1.0 / (1 + queue_depth * 0.1)
        score *= load_factor
        
        return score
    
    def select_best_machine(
        self, 
        job: Job, 
        machines: List[Machine],
        queue_depths: Optional[Dict[str, int]] = None
    ) -> Optional[Machine]:
        """
        Select optimal machine for a given job using ToC principles.
        """
        if queue_depths is None:
            queue_depths = {}
        
        best_machine = None
        best_score = -1.0
        
        for machine in machines:
            # Skip unavailable machines
            if machine.status in ["DOWN", "MAINTENANCE"]:
                continue
            
            score = self.calculate_machine_score(
                machine, 
                job, 
                queue_depths.get(machine.machine_id, 0)
            )
            
            if score > best_score:
                best_score = score
                best_machine = machine
        
        return best_machine
    
    def prioritize_jobs(self, jobs: List[Job]) -> List[Job]:
        """
        Sort jobs by ToC priority rules.
        
        Order:
        1. Hot lots first (is_hot_lot=True)
        2. Priority level (1-5, 1=highest)
        3. Created at (FIFO)
        """
        return sorted(
            jobs,
            key=lambda j: (
                not j.is_hot_lot,      # False (hot lots) come first
                j.priority_level,       # Lower number = higher priority
                j.created_at            # Earlier = first
            )
        )
    
    def dispatch_batch(
        self,
        pending_jobs: List[Job],
        available_machines: List[Machine],
        queue_depths: Optional[Dict[str, int]] = None,
        max_dispatches: int = 5
    ) -> List[DispatchDecision]:
        """
        Run ToC dispatch algorithm on pending jobs.
        
        Returns list of dispatch decisions.
        """
        decisions = []
        
        # Prioritize jobs
        sorted_jobs = self.prioritize_jobs(pending_jobs)
        
        # Track machine assignments in this batch
        assigned_machines = set()
        
        for job in sorted_jobs:
            if len(decisions) >= max_dispatches:
                break
            
            # Filter out already assigned machines
            free_machines = [
                m for m in available_machines 
                if m.machine_id not in assigned_machines
            ]
            
            best_machine = self.select_best_machine(job, free_machines, queue_depths)
            
            if best_machine:
                # Build decision reason
                reason_parts = [
                    f"ToC Dispatch v{self.algorithm_version}",
                    f"Job: {job.job_name} (P{job.priority_level})",
                    f"Machine: {best_machine.name}",
                    f"Efficiency: {best_machine.efficiency_rating:.0%}",
                ]
                
                if job.is_hot_lot:
                    reason_parts.insert(1, "HOT LOT - Priority Bypass")
                
                decision = DispatchDecision(
                    job_id=job.job_id,
                    machine_id=best_machine.machine_id,
                    reason=" | ".join(reason_parts),
                    timestamp=datetime.utcnow()
                )
                
                decisions.append(decision)
                assigned_machines.add(best_machine.machine_id)
                self.dispatch_count += 1
                
                logger.info(f"Dispatched {job.job_id} to {best_machine.name}")
        
        return decisions


# Singleton instance
toc_engine = TheoryOfConstraintsEngine()
