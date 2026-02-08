"""
Aegis Sentinel Engine - Physics-based anomaly detection and safety circuit.

Ported from aegis/sentinel-agent/sentinel_agent.py for YieldOps API integration.
Sentinel agents (Docker containers) POST detections to the API. This engine also
provides server-side detection for sensor data flowing through YieldOps.
"""

import math
import uuid
import time
from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging

from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)


@dataclass
class Thresholds:
    """Safety thresholds for machine parameters."""
    temp_warning: float = 80.0
    temp_critical: float = 95.0
    temp_emergency: float = 105.0
    vibration_warning: float = 0.02   # mm/s
    vibration_critical: float = 0.05  # mm/s
    vibration_emergency: float = 0.08 # mm/s
    roc_temp_threshold: float = 5.0   # C per minute


THRESHOLDS = Thresholds()


class SentinelDetector:
    """Z-score + Rate-of-Change anomaly detection (ported from sentinel_agent.py)."""

    def __init__(self, window_size: int = 60):
        self.window_size = window_size
        self.history: Dict[str, deque] = {}
        self.last_values: Dict[str, float] = {}
        self.last_time: Dict[str, float] = {}

    def analyze(self, machine_id: str, metric: str, value: float) -> Optional[Dict]:
        """Analyze a single metric reading. Returns detection dict or None."""
        key = f"{machine_id}:{metric}"
        now = time.time()

        if key not in self.history:
            self.history[key] = deque(maxlen=self.window_size)
            self.last_values[key] = value
            self.last_time[key] = now
            return None

        history = self.history[key]
        history.append(value)

        if len(history) < 10:
            self.last_values[key] = value
            self.last_time[key] = now
            return None

        mean = sum(history) / len(history)
        variance = sum((x - mean) ** 2 for x in history) / len(history)
        std_dev = math.sqrt(variance) if variance > 0 else 0.001

        z_score = (value - mean) / std_dev if std_dev > 0 else 0

        time_delta = now - self.last_time[key]
        value_delta = value - self.last_values[key]
        roc = (value_delta / time_delta * 60) if time_delta > 0 else 0

        self.last_values[key] = value
        self.last_time[key] = now

        detection = None
        if metric == "temperature":
            detection = self._detect_temperature(value, z_score, roc)
        elif metric == "vibration":
            detection = self._detect_vibration(value, z_score, roc)

        if detection:
            detection["z_score"] = round(z_score, 2)
            detection["rate_of_change"] = round(roc, 2)
            return detection

        return None

    def _detect_temperature(self, temp: float, z_score: float, roc: float) -> Optional[Dict]:
        if temp > THRESHOLDS.temp_emergency or z_score > 4:
            return {
                "severity": "critical",
                "type": "thermal_runaway",
                "message": f"EMERGENCY: Temperature {temp:.1f}C exceeds emergency threshold",
                "threshold": THRESHOLDS.temp_emergency,
                "action": "emergency_stop",
                "zone": "red",
            }
        elif temp > THRESHOLDS.temp_critical or (z_score > 3 and roc > THRESHOLDS.roc_temp_threshold):
            return {
                "severity": "high",
                "type": "thermal_runaway",
                "message": f"CRITICAL: Thermal runaway detected at {temp:.1f}C (RoC: {roc:.1f}C/min)",
                "threshold": THRESHOLDS.temp_critical,
                "action": "reduce_thermal_load",
                "zone": "yellow",
            }
        elif temp > THRESHOLDS.temp_warning or z_score > 2.5:
            return {
                "severity": "medium",
                "type": "elevated_temperature",
                "message": f"WARNING: Elevated temperature {temp:.1f}C",
                "threshold": THRESHOLDS.temp_warning,
                "action": "increase_coolant",
                "zone": "green",
            }
        return None

    def _detect_vibration(self, vib: float, z_score: float, roc: float) -> Optional[Dict]:
        if vib > THRESHOLDS.vibration_emergency:
            return {
                "severity": "critical",
                "type": "bearing_failure",
                "message": f"EMERGENCY: Critical vibration {vib:.4f} mm/s - possible bearing failure",
                "threshold": THRESHOLDS.vibration_emergency,
                "action": "emergency_stop",
                "zone": "red",
            }
        elif vib > THRESHOLDS.vibration_critical or z_score > 3.5:
            return {
                "severity": "high",
                "type": "bearing_wear",
                "message": f"HIGH: Abnormal vibration {vib:.4f} mm/s detected",
                "threshold": THRESHOLDS.vibration_critical,
                "action": "alert_maintenance",
                "zone": "red",
            }
        elif vib > THRESHOLDS.vibration_warning or z_score > 2.5:
            return {
                "severity": "medium",
                "type": "increased_vibration",
                "message": f"WARNING: Elevated vibration {vib:.4f} mm/s",
                "threshold": THRESHOLDS.vibration_warning,
                "action": "schedule_inspection",
                "zone": "green",
            }
        return None


class SafetyCircuit:
    """3-tier safety circuit: Green (auto), Yellow (approval), Red (alert)."""

    @staticmethod
    def evaluate(severity: str, incident_type: str) -> str:
        """Returns safety zone based on severity."""
        if severity == "critical":
            return "red"
        elif severity == "high":
            return "yellow"
        else:
            return "green"

    @staticmethod
    def determine_action_status(zone: str) -> str:
        if zone == "green":
            return "auto_executed"
        elif zone == "yellow":
            return "pending_approval"
        else:
            return "alert_only"


# --- Supabase-backed storage for Aegis Sentinel ---


def store_incident(incident: Dict) -> None:
    """Store incident in Supabase aegis_incidents table."""
    try:
        # Convert to database schema format
        db_record = {
            "machine_id": incident["machine_id"],
            "severity": incident["severity"],
            "incident_type": incident["incident_type"],
            "message": incident.get("message", ""),
            "detected_value": incident.get("detected_value"),
            "threshold_value": incident.get("threshold_value"),
            "action_taken": incident.get("action_taken"),
            "action_status": incident.get("action_status", "alert_only"),
            "action_zone": incident.get("action_zone", "red"),
            "agent_type": incident.get("agent_type"),
            "z_score": incident.get("z_score"),
            "rate_of_change": incident.get("rate_of_change"),
            "resolved": incident.get("resolved", False),
            "resolved_at": incident.get("resolved_at"),
            "operator_notes": incident.get("operator_notes"),
        }
        supabase_service.client.table("aegis_incidents").insert(db_record).execute()
        logger.info(f"Incident stored in Supabase: {incident.get('incident_id')}")
    except Exception as e:
        logger.error(f"Failed to store incident in Supabase: {e}")
        raise


def get_incidents(
    severity: Optional[str] = None,
    machine_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 50,
) -> List[Dict]:
    """Get incidents from Supabase with filtering."""
    try:
        query = supabase_service.client.table("aegis_incidents").select("*")
        
        if severity:
            query = query.eq("severity", severity)
        if machine_id:
            query = query.eq("machine_id", machine_id)
        if resolved is not None:
            query = query.eq("resolved", resolved)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        
        # Map DB records to API format
        incidents = []
        for row in (response.data or []):
            incidents.append({
                "incident_id": str(row.get("incident_id", "")),
                "timestamp": row.get("created_at", ""),
                "machine_id": row.get("machine_id", ""),
                "severity": row.get("severity", "medium"),
                "incident_type": row.get("incident_type", ""),
                "message": row.get("message", ""),
                "detected_value": row.get("detected_value", 0),
                "threshold_value": row.get("threshold_value", 0),
                "action_taken": row.get("action_taken", ""),
                "action_status": row.get("action_status", "alert_only"),
                "action_zone": row.get("action_zone", "red"),
                "agent_type": row.get("agent_type"),
                "z_score": row.get("z_score"),
                "rate_of_change": row.get("rate_of_change"),
                "resolved": row.get("resolved", False),
                "resolved_at": row.get("resolved_at"),
                "operator_notes": row.get("operator_notes"),
            })
        return incidents
    except Exception as e:
        logger.error(f"Failed to fetch incidents from Supabase: {e}")
        return []


def get_incident_by_id(incident_id: str) -> Optional[Dict]:
    """Get a specific incident by ID."""
    try:
        response = supabase_service.client.table("aegis_incidents") \
            .select("*").eq("incident_id", incident_id).single().execute()
        
        if not response.data:
            return None
            
        row = response.data
        return {
            "incident_id": str(row.get("incident_id", "")),
            "timestamp": row.get("created_at", ""),
            "machine_id": row.get("machine_id", ""),
            "severity": row.get("severity", "medium"),
            "incident_type": row.get("incident_type", ""),
            "message": row.get("message", ""),
            "detected_value": row.get("detected_value", 0),
            "threshold_value": row.get("threshold_value", 0),
            "action_taken": row.get("action_taken", ""),
            "action_status": row.get("action_status", "alert_only"),
            "action_zone": row.get("action_zone", "red"),
            "agent_type": row.get("agent_type"),
            "z_score": row.get("z_score"),
            "rate_of_change": row.get("rate_of_change"),
            "resolved": row.get("resolved", False),
            "resolved_at": row.get("resolved_at"),
            "operator_notes": row.get("operator_notes"),
        }
    except Exception as e:
        logger.error(f"Failed to fetch incident {incident_id}: {e}")
        return None


def update_incident(incident_id: str, updates: Dict) -> bool:
    """Update an incident with new values."""
    try:
        # Map API fields to DB fields
        db_updates = {}
        if "action_status" in updates:
            db_updates["action_status"] = updates["action_status"]
        if "resolved" in updates:
            db_updates["resolved"] = updates["resolved"]
        if "resolved_at" in updates:
            db_updates["resolved_at"] = updates["resolved_at"]
        if "operator_notes" in updates:
            db_updates["operator_notes"] = updates["operator_notes"]
            
        if db_updates:
            supabase_service.client.table("aegis_incidents") \
                .update(db_updates).eq("incident_id", incident_id).execute()
            logger.info(f"Incident {incident_id} updated: {db_updates}")
        return True
    except Exception as e:
        logger.error(f"Failed to update incident {incident_id}: {e}")
        return False


def register_agent(agent_data: Dict) -> Dict:
    """Register a new sentinel agent in Supabase."""
    try:
        db_record = {
            "agent_type": agent_data["agent_type"],
            "machine_id": agent_data["machine_id"],
            "status": "active",
            "capabilities": agent_data.get("capabilities", []),
            "protocol": agent_data.get("protocol", "mqtt"),
            "last_heartbeat": datetime.utcnow().isoformat(),
            "detections_24h": 0,
        }
        response = supabase_service.client.table("aegis_agents").insert(db_record).execute()
        
        if response.data:
            row = response.data[0]
            return {
                "agent_id": str(row.get("agent_id", "")),
                "agent_type": row.get("agent_type", ""),
                "machine_id": row.get("machine_id", ""),
                "status": row.get("status", "active"),
                "last_heartbeat": row.get("last_heartbeat", ""),
                "detections_24h": row.get("detections_24h", 0),
                "uptime_hours": 0.0,
                "capabilities": row.get("capabilities", []),
                "protocol": row.get("protocol", "mqtt"),
            }
    except Exception as e:
        logger.error(f"Failed to register agent: {e}")
        raise


def get_agents() -> List[Dict]:
    """Get all registered agents from Supabase."""
    try:
        response = supabase_service.client.table("aegis_agents").select("*").execute()
        
        agents = []
        for row in (response.data or []):
            # Calculate uptime from created_at
            created_at = row.get("created_at", datetime.utcnow().isoformat())
            try:
                created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                uptime_hours = (datetime.utcnow() - created_dt.replace(tzinfo=None)).total_seconds() / 3600
            except:
                uptime_hours = 0.0
                
            agents.append({
                "agent_id": str(row.get("agent_id", "")),
                "agent_type": row.get("agent_type", ""),
                "machine_id": row.get("machine_id", ""),
                "status": row.get("status", "active"),
                "last_heartbeat": row.get("last_heartbeat", ""),
                "detections_24h": row.get("detections_24h", 0),
                "uptime_hours": round(uptime_hours, 1),
                "capabilities": row.get("capabilities", []),
                "protocol": row.get("protocol", "mqtt"),
            })
        return agents
    except Exception as e:
        logger.error(f"Failed to fetch agents: {e}")
        return []


def agent_heartbeat(agent_id: str) -> bool:
    """Update agent heartbeat timestamp."""
    try:
        response = supabase_service.client.table("aegis_agents") \
            .update({"last_heartbeat": datetime.utcnow().isoformat()}) \
            .eq("agent_id", agent_id).execute()
        return len(response.data or []) > 0
    except Exception as e:
        logger.error(f"Failed to update heartbeat for {agent_id}: {e}")
        return False


def get_safety_circuit_status() -> Dict:
    """Get current safety circuit status from Supabase."""
    try:
        now = datetime.utcnow()
        cutoff = (now - timedelta(hours=24)).isoformat()
        
        # Get recent incidents
        response = supabase_service.client.table("aegis_incidents") \
            .select("*").gte("created_at", cutoff).execute()
        
        recent = response.data or []
        green = sum(1 for i in recent if i.get("action_zone") == "green")
        yellow_pending = sum(
            1 for i in recent
            if i.get("action_zone") == "yellow" and i.get("action_status") == "pending_approval"
        )
        red = sum(1 for i in recent if i.get("action_zone") == "red")
        
        # Get active agents count
        agents_response = supabase_service.client.table("aegis_agents") \
            .select("*").eq("status", "active").execute()
        active_agents = len(agents_response.data or [])
        
        total_agents_response = supabase_service.client.table("aegis_agents") \
            .select("agent_id").execute()
        total_agents = len(total_agents_response.data or [])
        
        # Get last incident
        last_response = supabase_service.client.table("aegis_incidents") \
            .select("*").order("created_at", desc=True).limit(1).execute()
        last = None
        if last_response.data:
            row = last_response.data[0]
            last = {
                "incident_id": str(row.get("incident_id", "")),
                "timestamp": row.get("created_at", ""),
                "machine_id": row.get("machine_id", ""),
                "severity": row.get("severity", ""),
                "incident_type": row.get("incident_type", ""),
                "message": row.get("message", ""),
                "action_zone": row.get("action_zone", ""),
                "action_status": row.get("action_status", ""),
                "resolved": row.get("resolved", False),
            }
        
        return {
            "green_actions_24h": green,
            "yellow_pending": yellow_pending,
            "red_alerts_24h": red,
            "agents_active": active_agents,
            "agents_total": total_agents,
            "last_incident": last,
        }
    except Exception as e:
        logger.error(f"Failed to get safety circuit status: {e}")
        return {
            "green_actions_24h": 0,
            "yellow_pending": 0,
            "red_alerts_24h": 0,
            "agents_active": 0,
            "agents_total": 0,
            "last_incident": None,
        }


def get_summary() -> Dict:
    """Get sentinel summary from Supabase."""
    try:
        now = datetime.utcnow()
        cutoff = (now - timedelta(hours=24)).isoformat()
        
        # Get incidents from last 24h
        response = supabase_service.client.table("aegis_incidents") \
            .select("*").gte("created_at", cutoff).execute()
        recent = response.data or []
        
        critical = sum(1 for i in recent if i.get("severity") == "critical")
        
        # Get machine counts
        machine_counts: Dict[str, int] = {}
        for inc in recent:
            mid = inc.get("machine_id", "")
            if mid:
                machine_counts[mid] = machine_counts.get(mid, 0) + 1
        
        top_machines = sorted(machine_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Get active agents
        agents_response = supabase_service.client.table("aegis_agents") \
            .select("*").eq("status", "active").execute()
        active_agents = len(agents_response.data or [])
        
        # Get recent incidents (all time, sorted)
        recent_response = supabase_service.client.table("aegis_incidents") \
            .select("*").order("created_at", desc=True).limit(10).execute()
        
        recent_incidents = []
        for row in (recent_response.data or []):
            recent_incidents.append({
                "incident_id": str(row.get("incident_id", "")),
                "timestamp": row.get("created_at", ""),
                "machine_id": row.get("machine_id", ""),
                "severity": row.get("severity", ""),
                "incident_type": row.get("incident_type", ""),
                "message": row.get("message", ""),
                "action_zone": row.get("action_zone", ""),
                "action_status": row.get("action_status", ""),
                "resolved": row.get("resolved", False),
            })
        
        return {
            "total_incidents_24h": len(recent),
            "critical_incidents_24h": critical,
            "active_agents": active_agents,
            "safety_circuit": get_safety_circuit_status(),
            "recent_incidents": recent_incidents,
            "top_affected_machines": [
                {"machine_id": mid, "incident_count": cnt} for mid, cnt in top_machines
            ],
        }
    except Exception as e:
        logger.error(f"Failed to get summary: {e}")
        return {
            "total_incidents_24h": 0,
            "critical_incidents_24h": 0,
            "active_agents": 0,
            "safety_circuit": get_safety_circuit_status(),
            "recent_incidents": [],
            "top_affected_machines": [],
        }


# Singletons
sentinel_detector = SentinelDetector()
safety_circuit = SafetyCircuit()
