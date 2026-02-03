"""
Dispatch API

Theory of Constraints (ToC) dispatch algorithm implementation.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from app.core.toc_engine import toc_engine, Job, Machine
from app.services.supabase_service import supabase_service
from app.models.schemas import (
    DispatchRequest,
    DispatchBatchResponse,
    DispatchDecisionResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)


def dict_to_job(job_dict: dict) -> Job:
    """Convert database dict to Job dataclass."""
    return Job(
        job_id=job_dict["job_id"],
        job_name=job_dict.get("job_name", "Unknown"),
        priority_level=job_dict.get("priority_level", 5),
        wafer_count=job_dict.get("wafer_count", 0),
        is_hot_lot=job_dict.get("is_hot_lot", False),
        recipe_type=job_dict.get("recipe_type", "unknown"),
        created_at=datetime.fromisoformat(job_dict["created_at"].replace('Z', '+00:00')) if job_dict.get("created_at") else datetime.utcnow(),
        status=job_dict.get("status", "PENDING")
    )


def dict_to_machine(machine_dict: dict) -> Machine:
    """Convert database dict to Machine dataclass."""
    return Machine(
        machine_id=machine_dict["machine_id"],
        name=machine_dict.get("name", "Unknown"),
        status=machine_dict.get("status", "IDLE"),
        efficiency_rating=machine_dict.get("efficiency_rating", 0.5),
        type=machine_dict.get("type", "unknown"),
        current_wafer_count=machine_dict.get("current_wafer_count", 0)
    )


@router.post("/run", response_model=DispatchBatchResponse)
async def run_dispatch(request: DispatchRequest):
    """
    Execute Theory of Constraints dispatch algorithm.
    
    This endpoint:
    1. Fetches pending jobs from database
    2. Fetches available machines
    3. Runs ToC algorithm
    4. Updates job assignments
    5. Logs dispatch decisions
    """
    try:
        # Fetch pending jobs
        jobs_data = await supabase_service.get_pending_jobs(
            priority_filter=request.priority_filter
        )
        
        jobs = [dict_to_job(j) for j in jobs_data]
        
        # Fetch machines
        machines_data = await supabase_service.get_machines()
        machines = [dict_to_machine(m) for m in machines_data]
        
        # Get queue depths
        queue_depths = await supabase_service.get_machine_queue_depths()
        
        # Run ToC algorithm
        decisions = toc_engine.dispatch_batch(
            pending_jobs=jobs,
            available_machines=machines,
            queue_depths=queue_depths,
            max_dispatches=request.max_dispatches
        )
        
        # Apply decisions to database
        response_decisions = []
        for decision in decisions:
            # Update job assignment
            await supabase_service.assign_job(
                job_id=decision.job_id,
                machine_id=decision.machine_id
            )
            
            # Log decision
            decision_id = await supabase_service.log_dispatch_decision(
                job_id=decision.job_id,
                machine_id=decision.machine_id,
                reason=decision.reason
            )
            
            # Get machine name
            machine = next(
                (m for m in machines if m.machine_id == decision.machine_id),
                None
            )
            
            response_decisions.append(DispatchDecisionResponse(
                decision_id=decision_id or "unknown",
                job_id=decision.job_id,
                machine_id=decision.machine_id,
                machine_name=machine.name if machine else "Unknown",
                reason=decision.reason,
                dispatched_at=decision.timestamp
            ))
        
        return DispatchBatchResponse(
            decisions=response_decisions,
            total_dispatched=len(response_decisions),
            algorithm_version=toc_engine.algorithm_version
        )
        
    except Exception as e:
        logger.error(f"Dispatch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue")
async def get_dispatch_queue():
    """Get current dispatch queue status."""
    try:
        jobs_data = await supabase_service.get_pending_jobs()
        machines = await supabase_service.get_machines()
        
        jobs = [dict_to_job(j) for j in jobs_data]
        prioritized = toc_engine.prioritize_jobs(jobs)
        
        available_machines = [m for m in machines if m.get("status") == "IDLE"]
        
        return {
            "pending_jobs": len(jobs),
            "available_machines": len(available_machines),
            "queued_jobs": len([m for m in machines if m.get("status") == "RUNNING"]),
            "next_dispatch": [
                {
                    "job_id": j.job_id,
                    "job_name": j.job_name,
                    "priority_level": j.priority_level,
                    "is_hot_lot": j.is_hot_lot
                }
                for j in prioritized[:5]
            ]
        }
    except Exception as e:
        logger.error(f"Error getting dispatch queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_dispatch_history(limit: int = Query(default=50, ge=1, le=100)):
    """Get recent dispatch decisions."""
    try:
        history = await supabase_service.get_dispatch_history(limit)
        return history
    except Exception as e:
        logger.error(f"Error getting dispatch history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/algorithm")
async def get_algorithm_info():
    """Get information about the ToC dispatch algorithm."""
    return {
        "version": toc_engine.algorithm_version,
        "name": "Theory of Constraints Dispatch",
        "description": "Implements Goldratt's Theory of Constraints for job dispatch",
        "priority_rules": [
            "1. Hot Lots (is_hot_lot=True) always first",
            "2. Priority level (1=highest, 5=lowest)",
            "3. FIFO within same priority"
        ],
        "machine_selection": [
            "1. Highest efficiency rating",
            "2. IDLE status preferred",
            "3. Lowest queue depth"
        ],
        "total_dispatches": toc_engine.dispatch_count
    }
