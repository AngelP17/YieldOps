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
    failure_type: str  # Accept string, validate manually
    machine_id: Optional[str] = None
    duration_seconds: int = Field(default=300, ge=30, le=3600)
    severity: str = "medium"


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
        
        failure_type = request.failure_type.lower().replace('-', '_')
        
        if failure_type == "machine_down":
            await supabase_service.update_machine_status(
                machine_id=machine["machine_id"],
                status="DOWN"
            )
            
            # Reassign any running jobs
            await supabase_service.reassign_jobs_from_machine(
                machine_id=machine["machine_id"]
            )
            
            # Create Aegis incident for machine failure
            from datetime import datetime
            # Ensure agent exists for this machine before creating incident
            await supabase_service.ensure_aegis_agent_exists(
                machine_name=machine["name"],
                machine_type=machine.get("type", "facility"),
                machine_status=machine.get("status", "IDLE")
            )
            incident = await supabase_service.create_aegis_incident({
                "machine_id": machine["name"],
                "severity": "critical",
                "incident_type": "machine_failure",
                "message": f"Machine {machine['name']} is DOWN - Chaos injected",
                "detected_value": 0,
                "threshold_value": 0,
                "action_taken": "reassign_jobs",
                "action_status": "auto_executed",
                "action_zone": "red",
                "agent_type": "facility",
                "z_score": 0,
                "rate_of_change": 0,
                "resolved": False
            })
            
            logger.warning(f"CHAOS: Machine {machine['name']} forced DOWN, Aegis incident created")
            
            return {
                "injected": True,
                "scenario": "Machine Down",
                "affected_machine": machine["name"],
                "machine_id": machine["machine_id"],
                "duration": request.duration_seconds,
                "auto_recovery": True,
                "aegis_incident_created": incident.get("incident_id") if incident else None,
                "message": f"Machine {machine['name']} is now DOWN. Jobs rerouted. Aegis incident created."
            }
        
        elif failure_type == "sensor_spike":
            # Generate anomalous readings
            readings = []
            for _ in range(5):
                reading = await supabase_service.insert_sensor_reading(
                    machine_id=machine["machine_id"],
                    temperature=random.uniform(90, 100),
                    vibration=random.uniform(5, 8),
                    is_anomaly=True
                )
                readings.append(reading)
            
            # Also create an Aegis incident directly
            from datetime import datetime
            # Ensure agent exists before creating incident
            await supabase_service.ensure_aegis_agent_exists(
                machine_name=machine["name"],
                machine_type=machine.get("type", "facility"),
                machine_status=machine.get("status", "IDLE")
            )
            incident = await supabase_service.create_aegis_incident({
                "machine_id": machine["name"],
                "severity": "high",
                "incident_type": "chaos_injected_anomaly",
                "message": f"CHAOS: Sensor anomaly spike detected on {machine['name']}",
                "detected_value": readings[0]["temperature"] if readings else 95.0,
                "threshold_value": machine.get("max_temperature", 85.0),
                "action_taken": "alert_operator",
                "action_status": "auto_executed",
                "action_zone": "yellow",
                "agent_type": "facility",
                "z_score": 3.5,
                "rate_of_change": 5.0,
                "resolved": False
            })
            
            logger.warning(f"CHAOS: Sensor spikes injected for {machine['name']}, Aegis incident created")
            
            return {
                "injected": True,
                "scenario": "Sensor Anomaly Spike",
                "affected_machine": machine["name"],
                "readings_generated": len(readings),
                "aegis_incident_created": incident.get("incident_id") if incident else None,
                "message": "Anomalous sensor readings injected. Aegis incident created."
            }
        
        elif failure_type == "efficiency_drop":
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
        logger.error(f"Chaos injection failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chaos injection failed: {str(e)}")


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
