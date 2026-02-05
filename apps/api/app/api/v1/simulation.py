"""
Simulation API

Triggers autonomous job simulation for realistic fab behavior.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.supabase_service import supabase_service

router = APIRouter()
logger = logging.getLogger(__name__)


class SimulationResponse(BaseModel):
    """Response from simulation tick"""
    pending_dispatched: int = 0
    queued_started: int = 0
    running_completed: int = 0
    running_failed: int = 0
    new_jobs_created: int = 0
    timestamp: str = ""


class SimulationStatusResponse(BaseModel):
    """Current simulation status"""
    jobs: dict
    machines: dict
    timestamp: str


@router.post("/tick", response_model=SimulationResponse)
async def run_simulation_tick():
    """
    Run one tick of the job simulation.
    
    This advances jobs through their lifecycle:
    - PENDING jobs are dispatched to idle machines (QUEUED)
    - QUEUED jobs start processing (RUNNING)
    - RUNNING jobs complete or fail
    - New jobs are generated to keep the queue populated
    - Machine events (failures, recovery, efficiency changes)
    """
    try:
        response = supabase_service.client.rpc("simulate_job_progression").execute()
        
        if response.data:
            return SimulationResponse(**response.data)
        
        return SimulationResponse()
        
    except Exception as e:
        logger.error(f"Simulation tick error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.post("/fast")
async def run_fast_simulation(ticks: int = Query(default=5, ge=1, le=20)):
    """
    Run multiple simulation ticks at once.
    
    Useful for quickly advancing the simulation state.
    """
    try:
        response = supabase_service.client.rpc("simulate_fast", {"ticks": ticks}).execute()
        return response.data or {"ticks_executed": 0}
        
    except Exception as e:
        logger.error(f"Fast simulation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Fast simulation failed: {str(e)}")


@router.get("/status", response_model=SimulationStatusResponse)
async def get_simulation_status():
    """
    Get current simulation status.
    
    Returns counts of jobs and machines in each state.
    """
    try:
        response = supabase_service.client.rpc("get_simulation_status").execute()
        
        if response.data:
            return SimulationStatusResponse(**response.data)
        
        # Fallback to manual counting
        jobs = await supabase_service.get_jobs(limit=1000)
        machines = await supabase_service.get_machines()
        
        job_counts = {"pending": 0, "queued": 0, "running": 0, "completed": 0, "failed": 0, "total": 0}
        machine_counts = {"idle": 0, "running": 0, "down": 0, "maintenance": 0, "total": 0}
        
        for job in jobs:
            status = job.get("status", "").lower()
            if status in job_counts:
                job_counts[status] += 1
            job_counts["total"] += 1
        
        for machine in machines:
            status = machine.get("status", "").lower()
            if status in machine_counts:
                machine_counts[status] += 1
            machine_counts["total"] += 1
        
        from datetime import datetime
        return SimulationStatusResponse(
            jobs=job_counts,
            machines=machine_counts,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Status check error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.post("/reset")
async def reset_simulation():
    """
    Reset all jobs to a realistic initial distribution.
    
    - Resets jobs to mix of PENDING, QUEUED, RUNNING, COMPLETED, FAILED
    - Resets machines to mix of IDLE, RUNNING, DOWN, MAINTENANCE
    """
    try:
        # Reset all jobs to PENDING first
        supabase_service.client.table("production_jobs").update({
            "status": "PENDING",
            "assigned_machine_id": None,
            "actual_start_time": None,
            "actual_end_time": None
        }).neq("status", "NONEXISTENT").execute()
        
        # Reset all machines to IDLE
        supabase_service.client.table("machines").update({
            "status": "IDLE"
        }).neq("status", "NONEXISTENT").execute()
        
        # Run a few simulation ticks to create realistic distribution
        for _ in range(5):
            supabase_service.client.rpc("simulate_job_progression").execute()
        
        return {"message": "Simulation reset complete", "status": "success"}
        
    except Exception as e:
        logger.error(f"Simulation reset error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")
