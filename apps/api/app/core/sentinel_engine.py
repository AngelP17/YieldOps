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


# --- In-memory stores (MVP; swap to Supabase tables for production) ---

_incidents: List[Dict] = []
_agents: Dict[str, Dict] = {}


def store_incident(incident: Dict) -> None:
    _incidents.append(incident)


def get_incidents(
    severity: Optional[str] = None,
    machine_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 50,
) -> List[Dict]:
    result = list(_incidents)
    if severity:
        result = [i for i in result if i.get("severity") == severity]
    if machine_id:
        result = [i for i in result if i.get("machine_id") == machine_id]
    if resolved is not None:
        result = [i for i in result if i.get("resolved") == resolved]
    result.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return result[:limit]


def get_incident_by_id(incident_id: str) -> Optional[Dict]:
    for inc in _incidents:
        if inc.get("incident_id") == incident_id:
            return inc
    return None


def register_agent(agent_data: Dict) -> Dict:
    agent_id = f"agent-{agent_data['agent_type']}-{uuid.uuid4().hex[:8]}"
    agent = {
        "agent_id": agent_id,
        "agent_type": agent_data["agent_type"],
        "machine_id": agent_data["machine_id"],
        "status": "active",
        "last_heartbeat": datetime.utcnow().isoformat() + "Z",
        "detections_24h": 0,
        "uptime_hours": 0.0,
        "capabilities": agent_data.get("capabilities", []),
        "protocol": agent_data.get("protocol", "mqtt"),
    }
    _agents[agent_id] = agent
    return agent


def get_agents() -> List[Dict]:
    return list(_agents.values())


def agent_heartbeat(agent_id: str) -> bool:
    if agent_id in _agents:
        _agents[agent_id]["last_heartbeat"] = datetime.utcnow().isoformat() + "Z"
        return True
    return False


def get_safety_circuit_status() -> Dict:
    now = datetime.utcnow()
    cutoff = (now - timedelta(hours=24)).isoformat()

    recent = [i for i in _incidents if i.get("timestamp", "") >= cutoff]
    green = sum(1 for i in recent if i.get("action_zone") == "green")
    yellow_pending = sum(
        1 for i in recent
        if i.get("action_zone") == "yellow" and i.get("action_status") == "pending_approval"
    )
    red = sum(1 for i in recent if i.get("action_zone") == "red")

    active_agents = sum(1 for a in _agents.values() if a.get("status") == "active")
    last = _incidents[-1] if _incidents else None

    return {
        "green_actions_24h": green,
        "yellow_pending": yellow_pending,
        "red_alerts_24h": red,
        "agents_active": active_agents,
        "agents_total": len(_agents),
        "last_incident": last,
    }


def get_summary() -> Dict:
    now = datetime.utcnow()
    cutoff = (now - timedelta(hours=24)).isoformat()
    recent = [i for i in _incidents if i.get("timestamp", "") >= cutoff]

    critical = sum(1 for i in recent if i.get("severity") == "critical")

    machine_counts: Dict[str, int] = {}
    for inc in recent:
        mid = inc.get("machine_id", "")
        machine_counts[mid] = machine_counts.get(mid, 0) + 1

    top_machines = sorted(machine_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_incidents_24h": len(recent),
        "critical_incidents_24h": critical,
        "active_agents": sum(1 for a in _agents.values() if a.get("status") == "active"),
        "safety_circuit": get_safety_circuit_status(),
        "recent_incidents": sorted(_incidents, key=lambda x: x.get("timestamp", ""), reverse=True)[:10],
        "top_affected_machines": [
            {"machine_id": mid, "incident_count": cnt} for mid, cnt in top_machines
        ],
    }


# Singletons
sentinel_detector = SentinelDetector()
safety_circuit = SafetyCircuit()
