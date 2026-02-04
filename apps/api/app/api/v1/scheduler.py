"""
Scheduler Optimizer API Endpoints

Provides constraint-based job scheduling optimization.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging

from app.core.scheduler_optimizer import (
    SchedulerOptimizer,
    SchedulerJob,
    SchedulerMachine,
    ConstraintConfig,
    is_rust_available
)
from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scheduler", tags=["scheduler"])


class OptimizeRequest(BaseModel):
    """Request for scheduler optimization."""
    max_assignments: int = Field(default=10, ge=1, le=50)
    enforce_recipe_match: bool = True
    enforce_deadlines: bool = False
    priority_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    efficiency_weight: float = Field(default=0.3, ge=0.0, le=1.0)


class AssignmentResponse(BaseModel):
    """Single job-machine assignment."""
    job_id: str
    job_name: str
    machine_id: str
    machine_name: str
    score: float
    reason: str
    estimated_start_hours: float
    constraint_violations: List[str]


class OptimizeResponse(BaseModel):
    """Optimization result."""
    assignments: List[AssignmentResponse]
    total_score: float
    unassigned_jobs: List[str]
    optimization_time_ms: float
    backend: str  # "rust" or "python"


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_schedule(request: OptimizeRequest) -> OptimizeResponse:
    """
    Optimize job-to-machine assignments using constraint-based optimization.
    
    Uses Rust backend when available for best performance.
    Falls back to Python implementation otherwise.
    """
    try:
        # Get pending jobs from database
        jobs_data = await supabase_service.get_pending_jobs()
        
        # Get available machines
        machines_data = await supabase_service.get_machines()
        
        if not jobs_data:
            return OptimizeResponse(
                assignments=[],
                total_score=0.0,
                unassigned_jobs=[],
                optimization_time_ms=0.0,
                backend="none"
            )
        
        # Convert to scheduler types
        jobs = [
            SchedulerJob(
                job_id=j["job_id"],
                job_name=j["job_name"],
                priority_level=j["priority_level"],
                wafer_count=j["wafer_count"],
                is_hot_lot=j.get("is_hot_lot", False),
                recipe_type=j.get("recipe_type", "unknown"),
                deadline_hours=_calculate_deadline_hours(j.get("deadline"))
            )
            for j in jobs_data
        ]
        
        machines = [
            SchedulerMachine(
                machine_id=m["machine_id"],
                name=m["name"],
                machine_type=m.get("type", "unknown"),
                status=m.get("status", "IDLE"),
                efficiency_rating=float(m.get("efficiency_rating", 0.9)),
                current_queue_depth=m.get("current_wafer_count", 0),
                estimated_available_hours=0.0
            )
            for m in machines_data
            if m.get("status") in ["IDLE", "RUNNING"]
        ]
        
        # Create optimizer with config
        config = ConstraintConfig(
            enforce_recipe_match=request.enforce_recipe_match,
            enforce_deadlines=request.enforce_deadlines,
            priority_weight=request.priority_weight,
            efficiency_weight=request.efficiency_weight,
        )
        optimizer = SchedulerOptimizer(config=config)
        
        # Run optimization
        result = optimizer.optimize(jobs, machines, request.max_assignments)
        
        return OptimizeResponse(
            assignments=[
                AssignmentResponse(
                    job_id=a.job_id,
                    job_name=a.job_name,
                    machine_id=a.machine_id,
                    machine_name=a.machine_name,
                    score=a.score,
                    reason=a.reason,
                    estimated_start_hours=a.estimated_start_hours,
                    constraint_violations=a.constraint_violations
                )
                for a in result.assignments
            ],
            total_score=result.total_score,
            unassigned_jobs=result.unassigned_jobs,
            optimization_time_ms=result.optimization_time_ms,
            backend=optimizer.backend
        )
        
    except Exception as e:
        logger.error(f"Scheduler optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_scheduler_status():
    """Get scheduler status and backend info."""
    return {
        "rust_available": is_rust_available(),
        "backend": "rust" if is_rust_available() else "python",
        "version": "1.0.0"
    }


def _calculate_deadline_hours(deadline) -> Optional[float]:
    """Calculate hours until deadline."""
    if deadline is None:
        return None
    
    try:
        if isinstance(deadline, str):
            deadline_dt = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        elif isinstance(deadline, datetime):
            deadline_dt = deadline
        else:
            return None
        
        now = datetime.now(deadline_dt.tzinfo) if deadline_dt.tzinfo else datetime.now()
        delta = deadline_dt - now
        return max(0.0, delta.total_seconds() / 3600)
    except Exception:
        return None
