"""
Jobs API

CRUD operations for production job management.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from app.services.supabase_service import supabase_service
from app.models.schemas import (
    ProductionJobResponse,
    ProductionJobCreate,
    ProductionJobUpdate,
    JobQueueItem
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[ProductionJobResponse])
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[int] = Query(None, ge=1, le=5, description="Filter by priority level"),
    hot_lot_only: bool = Query(False, description="Show only hot lots")
):
    """List all production jobs with optional filtering."""
    try:
        # Get jobs from database
        jobs = await supabase_service.get_pending_jobs(priority_filter=priority)
        
        # Filter by status if specified
        if status:
            # Would query database with status filter
            pass
        
        # Filter hot lots
        if hot_lot_only:
            jobs = [j for j in jobs if j.get("is_hot_lot")]
        
        return jobs
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue")
async def get_job_queue():
    """Get the current job queue status."""
    try:
        pending_jobs = await supabase_service.get_pending_jobs()
        
        # Sort by priority (hot lots first, then by priority level)
        queue = sorted(
            pending_jobs,
            key=lambda j: (
                not j.get("is_hot_lot", False),
                j.get("priority_level", 5)
            )
        )
        
        return {
            "queue_length": len(queue),
            "hot_lots": len([j for j in queue if j.get("is_hot_lot")]),
            "jobs": queue[:20]  # Return top 20
        }
    except Exception as e:
        logger.error(f"Error getting job queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}", response_model=ProductionJobResponse)
async def get_job(job_id: str):
    """Get a specific job by ID."""
    try:
        # Would query database for specific job
        # For now, return mock data
        return {
            "job_id": job_id,
            "job_name": f"JOB-{job_id[:8]}",
            "wafer_count": 25,
            "priority_level": 2,
            "recipe_type": "STANDARD_LOGIC",
            "status": "PENDING",
            "is_hot_lot": False,
            "assigned_machine_id": None,
            "actual_start_time": None,
            "actual_end_time": None,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
    except Exception as e:
        logger.error(f"Error getting job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ProductionJobResponse)
async def create_job(job: ProductionJobCreate):
    """Create a new production job."""
    try:
        # Would insert into database
        logger.info(f"Creating job: {job.job_name}")
        
        return {
            "job_id": "new-job-id",
            **job.model_dump(),
            "status": "PENDING",
            "assigned_machine_id": None,
            "actual_start_time": None,
            "actual_end_time": None,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
    except Exception as e:
        logger.error(f"Error creating job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{job_id}")
async def update_job(job_id: str, update: ProductionJobUpdate):
    """Update a job's status or assignment."""
    try:
        logger.info(f"Updating job {job_id}")
        
        if update.assigned_machine_id:
            await supabase_service.assign_job(job_id, update.assigned_machine_id)
        
        return {"message": "Job updated", "job_id": job_id}
    except Exception as e:
        logger.error(f"Error updating job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a pending job."""
    try:
        logger.info(f"Cancelling job {job_id}")
        return {"message": "Job cancelled", "job_id": job_id}
    except Exception as e:
        logger.error(f"Error cancelling job: {e}")
        raise HTTPException(status_code=500, detail=str(e))
