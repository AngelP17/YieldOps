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
        job = await supabase_service.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ProductionJobResponse)
async def create_job(job: ProductionJobCreate):
    """Create a new production job."""
    try:
        logger.info(f"Creating job: {job.job_name}")
        
        # Insert into database
        job_data = {
            **job.model_dump(exclude_unset=True),
            "status": "PENDING",
            "assigned_machine_id": None,
            "actual_start_time": None,
            "actual_end_time": None,
        }
        
        created_job = await supabase_service.create_job(job_data)
        return created_job
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
        
        # First check if job exists and can be cancelled
        job = await supabase_service.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Only allow cancelling PENDING or QUEUED jobs
        if job.get("status") not in ["PENDING", "QUEUED"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot cancel job with status '{job.get('status')}'. Only PENDING or QUEUED jobs can be cancelled."
            )
        
        # Update job status to CANCELLED
        await supabase_service.update_job_status(job_id, "CANCELLED")
        
        return {"message": "Job cancelled", "job_id": job_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling job: {e}")
        raise HTTPException(status_code=500, detail=str(e))
