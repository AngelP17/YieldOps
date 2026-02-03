from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, List
import random
import logging

from app.services.supabase_service import supabase_service

router = APIRouter()
logger = logging.getLogger(__name__)


class FailureType(str, Enum):
    MACHINE_DOWN = "machine_down"
    SENSOR_SPIKE = "sensor_spike"
    NETWORK_PARTITION = "network_partition"
    EFFICIENCY_DROP = "efficiency_drop"


class ChaosRequest(BaseModel):
    failure_type: FailureType
    machine_id: Optional[str] = None
    duration_seconds: int = Field(default=300, ge=30, le=3600)
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")


@router.post("/inject")
async def inject_failure(request: ChaosRequest):
    """
    Inject a controlled failure into the system.
    
    Examples:
    - Force a machine DOWN to test dispatch rerouting
    - Generate anomalous sensor readings to test ML detection
    - Simulate efficiency degradation
    """
    try:
        # Get target machine
        if request.machine_id:
            machine = await supabase_service.get_machine(request.machine_id)
            if not machine:
                raise HTTPException(status_code=404, detail="Machine not found")
        else:
            # Random machine
            machines = await supabase_service.get_machines()
            if not machines:
                raise HTTPException(status_code=400, detail="No machines available")
            machine = random.choice(machines)
        
        if request.failure_type == FailureType.MACHINE_DOWN:
            await supabase_service.update_machine_status(
                machine_id=machine["machine_id"],
                status="DOWN"
            )
            
            # Reassign any running jobs
            await supabase_service.reassign_jobs_from_machine(
                machine_id=machine["machine_id"]
            )
            
            logger.warning(f"CHAOS: Machine {machine['name']} forced DOWN")
            
            return {
                "injected": True,
                "scenario": "Machine Down",
                "affected_machine": machine["name"],
                "machine_id": machine["machine_id"],
                "duration": request.duration_seconds,
                "auto_recovery": True,
                "message": f"Machine {machine['name']} is now DOWN. Jobs will be rerouted."
            }
        
        elif request.failure_type == FailureType.SENSOR_SPIKE:
            # Generate anomalous readings
            readings = []
            for _ in range(10):
                reading = await supabase_service.insert_sensor_reading(
                    machine_id=machine["machine_id"],
                    temperature=random.uniform(90, 100),
                    vibration=random.uniform(5, 8),
                    is_anomaly=True
                )
                readings.append(reading)
            
            logger.warning(f"CHAOS: Sensor spikes injected for {machine['name']}")
            
            return {
                "injected": True,
                "scenario": "Sensor Anomaly Spike",
                "affected_machine": machine["name"],
                "readings_generated": len(readings),
                "message": "Anomalous sensor readings injected. ML model should detect."
            }
        
        elif request.failure_type == FailureType.EFFICIENCY_DROP:
            new_efficiency = random.uniform(0.4, 0.6)
            await supabase_service.update_machine_efficiency(
                machine_id=machine["machine_id"],
                efficiency=new_efficiency
            )
            
            logger.warning(f"CHAOS: Efficiency dropped for {machine['name']} to {new_efficiency}")
            
            return {
                "injected": True,
                "scenario": "Efficiency Degradation",
                "affected_machine": machine["name"],
                "new_efficiency": new_efficiency,
                "message": f"Machine {machine['name']} efficiency degraded to {new_efficiency:.0%}"
            }
        
        else:
            raise HTTPException(status_code=400, detail="Failure type not implemented")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chaos injection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recover/{machine_id}")
async def recover_machine(machine_id: str):
    """Manually recover a machine from failure."""
    try:
        await supabase_service.update_machine_status(
            machine_id=machine_id,
            status="IDLE"
        )
        
        # Reset efficiency if needed
        await supabase_service.update_machine_efficiency(
            machine_id=machine_id,
            efficiency=0.90
        )
        
        return {
            "recovered": True,
            "machine_id": machine_id,
            "new_status": "IDLE"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scenarios")
async def list_scenarios():
    """List available chaos scenarios."""
    return [
        {
            "id": "machine_down",
            "name": "Machine Failure",
            "description": "Force a machine to DOWN status, triggering job rerouting",
            "impact": "High - Affects production capacity",
            "recovery": "Automatic after duration or manual recovery"
        },
        {
            "id": "sensor_spike",
            "name": "Sensor Anomaly",
            "description": "Inject anomalous temperature/vibration readings",
            "impact": "Medium - Triggers ML alert system",
            "recovery": "Automatic - Data ages out"
        },
        {
            "id": "efficiency_drop",
            "name": "Efficiency Degradation",
            "description": "Reduce machine efficiency rating",
            "impact": "Medium - Affects dispatch decisions",
            "recovery": "Manual recovery required"
        }
    ]
