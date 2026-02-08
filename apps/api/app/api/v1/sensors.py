"""
Sensor Simulation API

Endpoints for managing the sensor data simulator that feeds
real-time data to Aegis Sentinel.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional
import logging

from app.core.sensor_simulator import sensor_simulator, start_sensor_simulation, stop_sensor_simulation

router = APIRouter()
logger = logging.getLogger(__name__)


class SensorSimulationResponse(BaseModel):
    status: str
    readings_generated: int = 0
    anomalies_created: int = 0
    message: str


class SensorSimulationStatus(BaseModel):
    running: bool
    interval_seconds: int
    last_tick: Optional[str] = None


@router.post("/simulate", response_model=SensorSimulationResponse)
async def run_sensor_simulation_tick():
    """
    Run a single sensor simulation tick.
    
    Generates sensor readings for all machines. This will:
    1. Create sensor_readings records
    2. Trigger the Aegis auto-incident creation if thresholds breached
    3. Populate the Sentinel dashboard with real data
    """
    try:
        result = await sensor_simulator.run_single_tick()
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return SensorSimulationResponse(
            status="success",
            readings_generated=result.get("readings_generated", 0),
            anomalies_created=result.get("anomalies_created", 0),
            message=f"Generated {result.get('readings_generated', 0)} sensor readings"
        )
        
    except Exception as e:
        logger.error(f"Sensor simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start")
async def start_continuous_simulation():
    """
    Start continuous sensor simulation.
    
    Runs every 30 seconds to generate sensor data continuously.
    This keeps the Sentinel dashboard updated with live data.
    """
    try:
        start_sensor_simulation()
        return {
            "status": "started",
            "interval_seconds": 30,
            "message": "Continuous sensor simulation started"
        }
    except Exception as e:
        logger.error(f"Failed to start sensor simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_continuous_simulation():
    """Stop the continuous sensor simulation."""
    try:
        stop_sensor_simulation()
        return {
            "status": "stopped",
            "message": "Sensor simulation stopped"
        }
    except Exception as e:
        logger.error(f"Failed to stop sensor simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=SensorSimulationStatus)
async def get_simulation_status():
    """Get the current status of the sensor simulator."""
    return SensorSimulationStatus(
        running=sensor_simulator.running,
        interval_seconds=sensor_simulator.tick_interval
    )


@router.post("/generate-anomaly")
async def generate_anomaly_reading(machine_id: Optional[str] = None):
    """
    Generate an anomalous sensor reading for a specific machine.
    
    This will create a high-temperature/high-vibration reading that
    should trigger an Aegis incident.
    """
    try:
        from app.services.supabase_service import supabase_service
        import random
        
        # Get target machine
        if machine_id:
            machine = await supabase_service.get_machine(machine_id)
            if not machine:
                raise HTTPException(status_code=404, detail="Machine not found")
        else:
            # Random machine
            machines = await supabase_service.get_machines()
            if not machines:
                raise HTTPException(status_code=400, detail="No machines available")
            machine = random.choice(machines)
        
        # Generate anomalous reading
        reading = await supabase_service.insert_sensor_reading(
            machine_id=machine["machine_id"],
            temperature=random.uniform(90.0, 105.0),  # High temp
            vibration=random.uniform(0.05, 0.15),  # High vibration
            is_anomaly=True
        )
        
        return {
            "status": "success",
            "machine_id": machine["machine_id"],
            "machine_name": machine.get("name"),
            "reading_id": reading.get("reading_id"),
            "temperature": reading.get("temperature"),
            "vibration": reading.get("vibration"),
            "message": "Anomaly reading created - Aegis incident should be triggered"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate anomaly: {e}")
        raise HTTPException(status_code=500, detail=str(e))
