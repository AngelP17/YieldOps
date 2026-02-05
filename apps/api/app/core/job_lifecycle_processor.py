"""
Job Lifecycle Processor

Handles the complete job lifecycle:
- QUEUED → RUNNING: When a machine starts processing
- RUNNING → COMPLETED: When processing finishes
- Handles job duration tracking and completion
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RunningJob:
    """Tracks a job that's currently running."""
    job_id: str
    machine_id: str
    started_at: datetime
    estimated_duration_minutes: int
    
    @property
    def estimated_completion(self) -> datetime:
        return self.started_at + timedelta(minutes=self.estimated_duration_minutes)
    
    @property
    def progress_percentage(self) -> float:
        """Calculate progress based on elapsed time."""
        elapsed = (datetime.utcnow() - self.started_at).total_seconds() / 60
        progress = min(100.0, (elapsed / self.estimated_duration_minutes) * 100)
        return progress


class JobLifecycleProcessor:
    """
    Processes job lifecycle transitions in production mode.
    
    This runs as a background task on the Koyeb backend to:
    1. Move QUEUED jobs to RUNNING when machines are available
    2. Complete jobs when their estimated duration elapses
    3. Update machine status accordingly
    """
    
    def __init__(self, supabase_client: Client):
        self.client = supabase_client
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._running_jobs: Dict[str, RunningJob] = {}  # job_id -> RunningJob
        self._check_interval_seconds = 10
        self._completion_count = 0
        
    async def _get_queued_jobs(self) -> List[Dict[str, Any]]:
        """Get all QUEUED jobs from database."""
        try:
            response = self.client.table("production_jobs") \
                .select("*") \
                .eq("status", "QUEUED") \
                .execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get queued jobs: {e}")
            return []
    
    async def _get_idle_machines(self) -> List[Dict[str, Any]]:
        """Get all IDLE machines."""
        try:
            response = self.client.table("machines") \
                .select("*") \
                .eq("status", "IDLE") \
                .execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get idle machines: {e}")
            return []
    
    async def _get_running_jobs(self) -> List[Dict[str, Any]]:
        """Get all RUNNING jobs from database."""
        try:
            response = self.client.table("production_jobs") \
                .select("*") \
                .eq("status", "RUNNING") \
                .execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get running jobs: {e}")
            return []
    
    async def _start_job(self, job_id: str, machine_id: str, estimated_minutes: int) -> bool:
        """Start a job: update job to RUNNING and machine to RUNNING."""
        try:
            now = datetime.utcnow()
            
            # Update job status
            self.client.table("production_jobs").update({
                "status": "RUNNING",
                "started_at": now.isoformat(),
                "updated_at": now.isoformat()
            }).eq("job_id", job_id).execute()
            
            # Update machine status
            self.client.table("machines").update({
                "status": "RUNNING",
                "current_job_id": job_id,
                "updated_at": now.isoformat()
            }).eq("machine_id", machine_id).execute()
            
            # Track locally
            self._running_jobs[job_id] = RunningJob(
                job_id=job_id,
                machine_id=machine_id,
                started_at=now,
                estimated_duration_minutes=estimated_minutes or 60
            )
            
            logger.info(f"Started job {job_id} on machine {machine_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start job {job_id}: {e}")
            return False
    
    async def _complete_job(self, job_id: str, machine_id: str) -> bool:
        """Complete a job: update job to COMPLETED and machine to IDLE."""
        try:
            now = datetime.utcnow()
            
            # Update job status
            self.client.table("production_jobs").update({
                "status": "COMPLETED",
                "completed_at": now.isoformat(),
                "updated_at": now.isoformat()
            }).eq("job_id", job_id).execute()
            
            # Update machine status
            self.client.table("machines").update({
                "status": "IDLE",
                "current_job_id": None,
                "updated_at": now.isoformat()
            }).eq("machine_id", machine_id).execute()
            
            # Remove from tracking
            if job_id in self._running_jobs:
                del self._running_jobs[job_id]
            
            self._completion_count += 1
            logger.info(f"Completed job {job_id} on machine {machine_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to complete job {job_id}: {e}")
            return False
    
    async def _process_queued_to_running(self):
        """Process QUEUED jobs and start them on their assigned machines."""
        queued_jobs = await self._get_queued_jobs()
        idle_machines = await self._get_idle_machines()
        
        # Create set of idle machine IDs
        idle_machine_ids = {m["machine_id"] for m in idle_machines}
        
        for job in queued_jobs:
            machine_id = job.get("assigned_machine_id")
            
            # Only start if the assigned machine is idle
            if machine_id and machine_id in idle_machine_ids:
                estimated_minutes = job.get("estimated_duration_minutes", 60)
                success = await self._start_job(job["job_id"], machine_id, estimated_minutes)
                
                if success:
                    # Remove from idle set to prevent double-assignment
                    idle_machine_ids.discard(machine_id)
                    
                # Small delay to prevent overwhelming the database
                await asyncio.sleep(0.1)
    
    async def _process_running_to_completed(self):
        """Process RUNNING jobs and complete them when duration elapsed."""
        # Sync with database to get current running jobs
        running_jobs = await self._get_running_jobs()
        
        for job in running_jobs:
            job_id = job["job_id"]
            machine_id = job.get("assigned_machine_id")
            
            if not machine_id:
                continue
            
            # Check if we have local tracking for this job
            if job_id in self._running_jobs:
                tracked_job = self._running_jobs[job_id]
                progress = tracked_job.progress_percentage
                
                # Complete if progress >= 100%
                if progress >= 100:
                    await self._complete_job(job_id, machine_id)
            else:
                # Job is running but not tracked - add to tracking
                started_at = job.get("started_at")
                if started_at:
                    try:
                        # Parse the started_at time
                        if isinstance(started_at, str):
                            started_at = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                        
                        estimated_minutes = job.get("estimated_duration_minutes", 60)
                        self._running_jobs[job_id] = RunningJob(
                            job_id=job_id,
                            machine_id=machine_id,
                            started_at=started_at,
                            estimated_duration_minutes=estimated_minutes
                        )
                        
                        # Check if should complete immediately
                        if self._running_jobs[job_id].progress_percentage >= 100:
                            await self._complete_job(job_id, machine_id)
                    except Exception as e:
                        logger.warning(f"Could not parse started_at for job {job_id}: {e}")
    
    async def _process_loop(self):
        """Main processing loop."""
        while self._running:
            try:
                # Process QUEUED → RUNNING
                await self._process_queued_to_running()
                
                # Process RUNNING → COMPLETED
                await self._process_running_to_completed()
                
                # Wait before next check
                await asyncio.sleep(self._check_interval_seconds)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in job lifecycle processor loop: {e}")
                await asyncio.sleep(5)  # Shorter delay on error
    
    def start(self):
        """Start the job lifecycle processor."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._process_loop())
        logger.info("Job lifecycle processor started")
    
    def stop(self):
        """Stop the job lifecycle processor."""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Job lifecycle processor stopped")
    
    def is_running(self) -> bool:
        """Check if processor is running."""
        return self._running
    
    def get_stats(self) -> Dict[str, Any]:
        """Get processor statistics."""
        return {
            "running": self._running,
            "check_interval_seconds": self._check_interval_seconds,
            "currently_running_jobs": len(self._running_jobs),
            "total_completed": self._completion_count,
            "running_job_details": [
                {
                    "job_id": rj.job_id,
                    "machine_id": rj.machine_id,
                    "progress_percentage": round(rj.progress_percentage, 1),
                    "estimated_completion": rj.estimated_completion.isoformat()
                }
                for rj in self._running_jobs.values()
            ]
        }


# Singleton instance
_lifecycle_processor: Optional[JobLifecycleProcessor] = None


def get_lifecycle_processor(supabase_client: Client) -> JobLifecycleProcessor:
    """Get or create the singleton lifecycle processor instance."""
    global _lifecycle_processor
    if _lifecycle_processor is None:
        _lifecycle_processor = JobLifecycleProcessor(supabase_client)
    return _lifecycle_processor
