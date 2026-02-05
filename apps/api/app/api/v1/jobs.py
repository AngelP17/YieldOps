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


@router.get("/lifecycle/status")
async def get_lifecycle_status():
    """Get job lifecycle processor status."""
    try:
        from app.core.job_lifecycle_processor import get_lifecycle_processor
        processor = get_lifecycle_processor(supabase_service.client)
        return processor.get_stats()
    except Exception as e:
        logger.error(f"Error getting lifecycle status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lifecycle/start")
async def start_lifecycle_processor():
    """Start the job lifecycle processor."""
    try:
        from app.core.job_lifecycle_processor import get_lifecycle_processor
        processor = get_lifecycle_processor(supabase_service.client)
        processor.start()
        return {"message": "Job lifecycle processor started"}
    except Exception as e:
        logger.error(f"Error starting lifecycle processor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lifecycle/stop")
async def stop_lifecycle_processor():
    """Stop the job lifecycle processor."""
    try:
        from app.core.job_lifecycle_processor import get_lifecycle_processor
        processor = get_lifecycle_processor(supabase_service.client)
        processor.stop()
        return {"message": "Job lifecycle processor stopped"}
    except Exception as e:
        logger.error(f"Error stopping lifecycle processor: {e}")
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


@router.post("/{job_id}/start")
async def start_job(job_id: str):
    """
    Manually start a QUEUED job.
    Changes status from QUEUED to RUNNING and updates machine status.
    """
    try:
        logger.info(f"Starting job {job_id}")
        
        # Check if job exists
        job = await supabase_service.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Only allow starting QUEUED jobs
        if job.get("status") != "QUEUED":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot start job with status '{job.get('status')}'. Only QUEUED jobs can be started."
            )
        
        machine_id = job.get("assigned_machine_id")
        if not machine_id:
            raise HTTPException(
                status_code=400,
                detail="Job has no assigned machine"
            )
        
        from datetime import datetime
        now = datetime.utcnow()
        
        # Update job to RUNNING
        supabase_service.client.table("production_jobs").update({
            "status": "RUNNING",
            "started_at": now.isoformat(),
            "updated_at": now.isoformat()
        }).eq("job_id", job_id).execute()
        
        # Update machine to RUNNING
        supabase_service.client.table("machines").update({
            "status": "RUNNING",
            "current_job_id": job_id,
            "updated_at": now.isoformat()
        }).eq("machine_id", machine_id).execute()
        
        return {
            "message": "Job started",
            "job_id": job_id,
            "machine_id": machine_id,
            "started_at": now.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{job_id}/complete")
async def complete_job(job_id: str):
    """
    Manually complete a RUNNING job.
    Changes status from RUNNING to COMPLETED and frees the machine.
    """
    try:
        logger.info(f"Completing job {job_id}")
        
        # Check if job exists
        job = await supabase_service.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Only allow completing RUNNING jobs
        if job.get("status") != "RUNNING":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot complete job with status '{job.get('status')}'. Only RUNNING jobs can be completed."
            )
        
        machine_id = job.get("assigned_machine_id")
        
        from datetime import datetime
        now = datetime.utcnow()
        
        # Update job to COMPLETED
        supabase_service.client.table("production_jobs").update({
            "status": "COMPLETED",
            "completed_at": now.isoformat(),
            "updated_at": now.isoformat()
        }).eq("job_id", job_id).execute()
        
        # Free the machine
        if machine_id:
            supabase_service.client.table("machines").update({
                "status": "IDLE",
                "current_job_id": None,
                "updated_at": now.isoformat()
            }).eq("machine_id", machine_id).execute()
        
        return {
            "message": "Job completed",
            "job_id": job_id,
            "machine_id": machine_id,
            "completed_at": now.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing job: {e}")
        raise HTTPException(status_code=500, detail=str(e))
