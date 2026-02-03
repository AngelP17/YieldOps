"""
Machines API

CRUD operations for machine management.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from app.services.supabase_service import supabase_service
from app.models.schemas import (
    MachineResponse,
    MachineUpdate,
    MachineStats
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[MachineResponse])
async def list_machines(
    status: Optional[str] = Query(None, description="Filter by status"),
    zone: Optional[str] = Query(None, description="Filter by location zone")
):
    """List all machines with optional filtering."""
    try:
        machines = await supabase_service.get_machines(status=status)
        
        # Filter by zone if specified
        if zone:
            machines = [m for m in machines if m.get("location_zone") == zone]
        
        return machines
    except Exception as e:
        logger.error(f"Error listing machines: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{machine_id}", response_model=MachineResponse)
async def get_machine(machine_id: str):
    """Get a specific machine by ID."""
    try:
        machine = await supabase_service.get_machine(machine_id)
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        return machine
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting machine: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{machine_id}")
async def update_machine(machine_id: str, update: MachineUpdate):
    """Update machine status or efficiency."""
    try:
        # Check if machine exists
        machine = await supabase_service.get_machine(machine_id)
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        
        # Update status if provided
        if update.status:
            await supabase_service.update_machine_status(machine_id, update.status.value)
        
        # Update efficiency if provided
        if update.efficiency_rating is not None:
            await supabase_service.update_machine_efficiency(machine_id, update.efficiency_rating)
        
        # Return updated machine
        return await supabase_service.get_machine(machine_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating machine: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{machine_id}/stats")
async def get_machine_stats(machine_id: str):
    """Get detailed statistics for a machine."""
    try:
        machine = await supabase_service.get_machine(machine_id)
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        
        # Get sensor readings for the last 24h
        readings = await supabase_service.get_sensor_readings(
            machine_id=machine_id,
            limit=100
        )
        
        # Calculate stats
        if readings:
            avg_temp = sum(r.get("temperature", 0) for r in readings) / len(readings)
            avg_vib = sum(r.get("vibration", 0) for r in readings) / len(readings)
            anomalies = len([r for r in readings if r.get("is_anomaly")])
        else:
            avg_temp = None
            avg_vib = None
            anomalies = 0
        
        return {
            "machine_id": machine_id,
            "name": machine["name"],
            "status": machine["status"],
            "efficiency_rating": machine["efficiency_rating"],
            "utilization_24h": 0.85,  # Mock value
            "avg_temperature_24h": avg_temp,
            "avg_vibration_24h": avg_vib,
            "anomaly_count_24h": anomalies,
            "recent_readings": readings[:5]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting machine stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{machine_id}/sensor-readings")
async def get_machine_sensor_readings(
    machine_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    anomalies_only: bool = False
):
    """Get sensor readings for a specific machine."""
    try:
        readings = await supabase_service.get_sensor_readings(
            machine_id=machine_id,
            limit=limit,
            include_anomalies_only=anomalies_only
        )
        return readings
    except Exception as e:
        logger.error(f"Error getting sensor readings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
