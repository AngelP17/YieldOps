"""
Aegis Sentinel API - Endpoints for sentinel agent reporting, incident management,
safety circuit, and knowledge graph operations.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from app.core.sentinel_engine import (
    sentinel_detector,
    safety_circuit,
    store_incident,
    get_incidents,
    get_incident_by_id,
    update_incident,
    register_agent,
    get_agents,
    agent_heartbeat,
    get_safety_circuit_status,
    get_summary,
)
from app.core.knowledge_graph_engine import kg_engine
from app.models.aegis_schemas import (
    IncidentCreate,
    IncidentResponse,
    IncidentApproval,
    AgentRegistration,
    AgentStatus,
    SafetyCircuitStatus,
    SentinelSummary,
    KnowledgeGraphResponse,
    KnowledgeGraphGenerateRequest,
    TelemetryAnalyzeRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== Incidents ==========

@router.post("/incidents", response_model=IncidentResponse)
async def report_incident(incident: IncidentCreate):
    """Report an incident detected by a sentinel agent."""
    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    action_status = safety_circuit.determine_action_status(incident.action_zone.value)

    record = {
        "incident_id": incident_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "machine_id": incident.machine_id,
        "severity": incident.severity.value,
        "incident_type": incident.incident_type,
        "message": incident.message,
        "detected_value": incident.detected_value,
        "threshold_value": incident.threshold_value,
        "action_taken": incident.recommended_action,
        "action_status": action_status,
        "action_zone": incident.action_zone.value,
        "agent_type": incident.agent_type.value if incident.agent_type else None,
        "z_score": incident.z_score,
        "rate_of_change": incident.rate_of_change,
        "resolved": False,
        "resolved_at": None,
        "operator_notes": None,
    }

    store_incident(record)
    logger.info(f"Incident {incident_id}: {incident.severity.value} on {incident.machine_id}")
    return record


@router.get("/incidents", response_model=List[IncidentResponse])
async def list_incidents(
    severity: Optional[str] = None,
    machine_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = Query(default=50, ge=1, le=500),
):
    """List incidents with optional filtering."""
    return get_incidents(severity=severity, machine_id=machine_id, resolved=resolved, limit=limit)


@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: str):
    """Get a specific incident."""
    inc = get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


@router.post("/incidents/{incident_id}/approve")
async def approve_incident(incident_id: str, approval: IncidentApproval):
    """Approve or reject a yellow-zone action."""
    inc = get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if inc.get("action_status") != "pending_approval":
        raise HTTPException(status_code=400, detail="Incident is not pending approval")

    new_status = "approved" if approval.approved else "rejected"
    updates = {"action_status": new_status}
    if approval.operator_notes:
        updates["operator_notes"] = approval.operator_notes
    
    if not update_incident(incident_id, updates):
        raise HTTPException(status_code=500, detail="Failed to update incident")

    return {"incident_id": incident_id, "action_status": new_status}


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, notes: IncidentApproval = None):
    """Mark an incident as resolved."""
    inc = get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    updates = {
        "resolved": True,
        "resolved_at": datetime.utcnow().isoformat() + "Z"
    }
    if notes and notes.operator_notes:
        updates["operator_notes"] = notes.operator_notes
    
    if not update_incident(incident_id, updates):
        raise HTTPException(status_code=500, detail="Failed to resolve incident")
        
    return {"incident_id": incident_id, "resolved": True}


# ========== Agents ==========

@router.post("/agents/register", response_model=AgentStatus)
async def register_sentinel_agent(registration: AgentRegistration):
    """Register a sentinel agent."""
    agent = register_agent(registration.model_dump())
    logger.info(f"Agent registered: {agent['agent_id']} ({registration.agent_type.value})")
    return agent


@router.get("/agents", response_model=List[AgentStatus])
async def list_agents():
    """List all registered sentinel agents."""
    return get_agents()


@router.post("/agents/{agent_id}/heartbeat")
async def update_agent_heartbeat(agent_id: str):
    """Update agent heartbeat timestamp."""
    if not agent_heartbeat(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent_id": agent_id, "status": "ok"}


# ========== Safety Circuit ==========

@router.get("/safety-circuit", response_model=SafetyCircuitStatus)
async def safety_circuit_status():
    """Get current safety circuit status across all zones."""
    return get_safety_circuit_status()


# ========== Knowledge Graph ==========

@router.post("/knowledge-graph/generate", response_model=KnowledgeGraphResponse)
async def generate_knowledge_graph(request: KnowledgeGraphGenerateRequest):
    """Generate knowledge graph from stored incidents."""
    incidents = get_incidents(
        resolved=None if request.include_resolved else False,
        limit=request.max_incidents,
    )
    if not incidents:
        return {"nodes": [], "edges": [], "stats": {"node_count": 0, "edge_count": 0, "central_concepts": []}}

    kg_engine.build_from_incidents(incidents)
    return kg_engine.to_cytoscape_json()


@router.get("/knowledge-graph", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph():
    """Get current knowledge graph (must generate first)."""
    result = kg_engine.to_cytoscape_json()
    return result


@router.get("/knowledge-graph/stats")
async def get_knowledge_graph_stats():
    """Get knowledge graph statistics."""
    cyto = kg_engine.to_cytoscape_json()
    return {
        "node_count": cyto["stats"]["node_count"],
        "edge_count": cyto["stats"]["edge_count"],
        "central_concepts": cyto["stats"]["central_concepts"],
        "communities": kg_engine.get_communities(),
    }


@router.get("/knowledge-graph/concepts/{concept}")
async def get_related_concepts(concept: str, depth: int = Query(default=2, ge=1, le=5)):
    """Get concepts related to a given concept."""
    related = kg_engine.find_related_concepts(concept, depth)
    return {"concept": concept, "related": related, "depth": depth}


# ========== Summary ==========

@router.get("/summary", response_model=SentinelSummary)
async def sentinel_summary():
    """Get sentinel summary for dashboard overview widgets."""
    return get_summary()


# ========== Telemetry Analysis ==========

@router.post("/telemetry/analyze")
async def analyze_telemetry(request: TelemetryAnalyzeRequest):
    """Analyze incoming telemetry for anomalies using sentinel detection."""
    results = []

    temp_detection = sentinel_detector.analyze(request.machine_id, "temperature", request.temperature)
    if temp_detection:
        results.append(temp_detection)

    vib_detection = sentinel_detector.analyze(request.machine_id, "vibration", request.vibration)
    if vib_detection:
        results.append(vib_detection)

    return {
        "machine_id": request.machine_id,
        "anomalies_detected": len(results),
        "detections": results,
    }
