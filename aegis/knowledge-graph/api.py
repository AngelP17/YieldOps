#!/usr/bin/env python3
"""
Aegis Knowledge Graph API

FastAPI service for generating knowledge graphs from Aegis incident data.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

from knowledge_graph import AegisKnowledgeGraph

app = FastAPI(
    title="Aegis Knowledge Graph API",
    description="Generate knowledge graphs from Aegis incident data",
    version="1.0.0"
)

# Enable CORS for dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Incident(BaseModel):
    incident_id: str
    machine_id: str
    type: str
    message: str
    severity: str
    action: str
    timestamp: Optional[str] = None


class KnowledgeGraphRequest(BaseModel):
    incidents: List[Incident]


class KnowledgeGraphResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    stats: Dict[str, Any]


# In-memory store for incidents (in production, use a database)
incident_store: List[Dict[str, Any]] = []


@app.get("/")
def root():
    return {
        "service": "Aegis Knowledge Graph API",
        "version": "1.0.0",
        "endpoints": [
            "/generate",
            "/graph",
            "/stats",
            "/concepts/{concept}"
        ]
    }


@app.post("/generate", response_model=KnowledgeGraphResponse)
def generate_graph(request: KnowledgeGraphRequest):
    """Generate a knowledge graph from incident data"""
    try:
        kg = AegisKnowledgeGraph()
        
        # Convert Pydantic models to dicts
        incidents = [inc.dict() for inc in request.incidents]
        kg.build_from_incidents(incidents)
        
        # Export to Cytoscape format
        result = kg.to_cytoscape_json()
        
        return KnowledgeGraphResponse(
            nodes=result['nodes'],
            edges=result['edges'],
            stats=result['stats']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest")
def ingest_incidents(request: KnowledgeGraphRequest):
    """Ingest incidents into the store"""
    global incident_store
    
    for inc in request.incidents:
        incident_store.append(inc.dict())
    
    # Keep only last 1000 incidents
    incident_store = incident_store[-1000:]
    
    return {
        "status": "success",
        "total_incidents": len(incident_store)
    }


@app.get("/graph", response_model=KnowledgeGraphResponse)
def get_graph():
    """Get knowledge graph from stored incidents"""
    if not incident_store:
        return KnowledgeGraphResponse(nodes=[], edges=[], stats={
            'node_count': 0,
            'edge_count': 0,
            'central_concepts': []
        })
    
    kg = AegisKnowledgeGraph()
    kg.build_from_incidents(incident_store)
    result = kg.to_cytoscape_json()
    
    return KnowledgeGraphResponse(
        nodes=result['nodes'],
        edges=result['edges'],
        stats=result['stats']
    )


@app.get("/stats")
def get_stats():
    """Get graph statistics"""
    if not incident_store:
        return {
            "total_incidents": 0,
            "node_count": 0,
            "edge_count": 0,
            "central_concepts": []
        }
    
    kg = AegisKnowledgeGraph()
    kg.build_from_incidents(incident_store)
    
    return {
        "total_incidents": len(incident_store),
        "node_count": len(kg.graph.nodes()),
        "edge_count": len(kg.graph.edges()),
        "central_concepts": kg.get_central_concepts(10)
    }


@app.get("/concepts/{concept}")
def get_related_concepts(concept: str, depth: int = 2):
    """Get concepts related to a given concept"""
    kg = AegisKnowledgeGraph()
    kg.build_from_incidents(incident_store)
    
    related = kg.find_related_concepts(concept, depth)
    
    return {
        "concept": concept,
        "related": related,
        "depth": depth
    }


@app.get("/communities")
def get_communities():
    """Get detected communities in the graph"""
    kg = AegisKnowledgeGraph()
    kg.build_from_incidents(incident_store)
    
    communities = kg.get_communities()
    
    return {
        "communities": communities,
        "count": len(communities)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
