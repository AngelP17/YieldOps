"""Pydantic models for Aegis Sentinel integration."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SafetyZone(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class ActionStatus(str, Enum):
    AUTO_EXECUTED = "auto_executed"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    ALERT_ONLY = "alert_only"


class AgentType(str, Enum):
    PRECISION = "precision"
    FACILITY = "facility"
    ASSEMBLY = "assembly"


# --- Incident Models ---

class IncidentCreate(BaseModel):
    machine_id: str
    severity: SeverityLevel
    incident_type: str
    message: str
    detected_value: float
    threshold_value: float
    recommended_action: str
    action_zone: SafetyZone
    agent_type: Optional[AgentType] = None
    z_score: Optional[float] = None
    rate_of_change: Optional[float] = None


class IncidentResponse(BaseModel):
    incident_id: str
    timestamp: str
    machine_id: str
    severity: SeverityLevel
    incident_type: str
    message: str
    detected_value: Optional[float] = None
    threshold_value: Optional[float] = None
    action_taken: Optional[str] = None
    action_status: ActionStatus
    action_zone: SafetyZone
    agent_type: Optional[AgentType] = None
    z_score: Optional[float] = None
    rate_of_change: Optional[float] = None
    resolved: bool = False
    resolved_at: Optional[str] = None
    operator_notes: Optional[str] = None


class IncidentApproval(BaseModel):
    approved: bool
    operator_notes: Optional[str] = None


# --- Agent Models ---

class AgentRegistration(BaseModel):
    agent_type: AgentType
    machine_id: str
    capabilities: List[str] = []
    protocol: str = "mqtt"


class AgentStatus(BaseModel):
    agent_id: str
    agent_type: AgentType
    machine_id: str
    status: str = "active"
    last_heartbeat: Optional[str] = None
    detections_24h: int = 0
    uptime_hours: float = 0.0
    capabilities: List[str] = []
    protocol: str = "mqtt"


# --- Safety Circuit Models ---

class SafetyCircuitStatus(BaseModel):
    green_actions_24h: int = 0
    yellow_pending: int = 0
    red_alerts_24h: int = 0
    agents_active: int = 0
    agents_total: int = 0
    last_incident: Optional[IncidentResponse] = None


# --- Knowledge Graph Models ---

class KnowledgeGraphResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    stats: Dict[str, Any]


class KnowledgeGraphGenerateRequest(BaseModel):
    include_resolved: bool = False
    max_incidents: int = Field(default=500, ge=10, le=5000)


# --- Summary ---

class SentinelSummary(BaseModel):
    total_incidents_24h: int = 0
    critical_incidents_24h: int = 0
    active_agents: int = 0
    safety_circuit: SafetyCircuitStatus
    recent_incidents: List[IncidentResponse] = []
    top_affected_machines: List[Dict[str, Any]] = []


# --- Telemetry Analysis ---

class TelemetryAnalyzeRequest(BaseModel):
    machine_id: str
    temperature: float
    vibration: float
