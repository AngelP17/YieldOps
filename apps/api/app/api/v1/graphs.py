"""
Graph API - Endpoints for Jobs and System Knowledge Graphs.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import logging

from app.core.jobs_graph_engine import jobs_graph_engine
from app.core.system_graph_engine import system_graph_engine
from app.services.supabase_service import supabase_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== Jobs Knowledge Graph ==========

@router.get("/jobs-graph", response_model=dict)
async def get_jobs_graph(
    include_completed: bool = True,
    customer_filter: Optional[str] = None,
):
    """
    Generate knowledge graph from production jobs.
    
    Shows relationships between jobs, machines, customers, recipes,
    status, and priority levels.
    """
    try:
        # Fetch jobs from database
        jobs_result = supabase_service.client.table("production_jobs")\
            .select("*")\
            .order("created_at", desc=True)\
            .limit(500)\
            .execute()
        
        jobs = jobs_result.data or []
        
        if not include_completed:
            jobs = [j for j in jobs if j.get("status") != "COMPLETED"]
        
        if customer_filter:
            jobs = [j for j in jobs if j.get("customer_tag", "").upper() == customer_filter.upper()]
        
        # Fetch machines for relationship mapping
        machines_result = supabase_service.client.table("machines")\
            .select("*")\
            .execute()
        
        machines = machines_result.data or []
        
        # Build graph
        jobs_graph_engine.build_from_jobs(jobs, machines)
        result = jobs_graph_engine.to_cytoscape_json()
        
        logger.info(f"Generated jobs graph: {result['stats']['node_count']} nodes, {result['stats']['edge_count']} edges")
        return result
        
    except Exception as e:
        logger.error(f"Error generating jobs graph: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate jobs graph: {str(e)}")


@router.get("/jobs-graph/stats", response_model=dict)
async def get_jobs_graph_stats():
    """Get statistics from the current jobs graph."""
    try:
        cyto = jobs_graph_engine.to_cytoscape_json()
        return {
            "node_count": cyto["stats"]["node_count"],
            "edge_count": cyto["stats"]["edge_count"],
            "central_concepts": cyto["stats"]["central_concepts"],
            "job_clusters": cyto["stats"]["job_clusters"],
            "customer_workload": cyto["stats"]["customer_workload"],
        }
    except Exception as e:
        logger.error(f"Error getting jobs graph stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get("/jobs-graph/customers", response_model=List[str])
async def get_jobs_customers():
    """Get list of unique customers from jobs."""
    try:
        result = supabase_service.client.table("production_jobs")\
            .select("customer_tag")\
            .neq("customer_tag", None)\
            .execute()
        
        customers = list(set(
            j.get("customer_tag") for j in (result.data or [])
            if j.get("customer_tag")
        ))
        return sorted(customers)
        
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        return []


# ========== System Knowledge Graph ==========

@router.get("/system-graph", response_model=dict)
async def get_system_graph():
    """
    Generate system-wide knowledge graph.
    
    Shows relationships between machines, zones, types, jobs,
    and operational status for the Overview tab.
    """
    try:
        # Fetch machines
        machines_result = supabase_service.client.table("machines")\
            .select("*")\
            .execute()
        
        machines = machines_result.data or []
        
        # Fetch active jobs
        jobs_result = supabase_service.client.table("production_jobs")\
            .select("*")\
            .in_("status", ["PENDING", "QUEUED", "RUNNING"])\
            .execute()
        
        jobs = jobs_result.data or []
        
        # Build graph
        system_graph_engine.build_from_system(machines, jobs)
        result = system_graph_engine.to_cytoscape_json()
        
        logger.info(f"Generated system graph: {result['stats']['node_count']} nodes, {result['stats']['edge_count']} edges")
        return result
        
    except Exception as e:
        logger.error(f"Error generating system graph: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate system graph: {str(e)}")


@router.get("/system-graph/stats", response_model=dict)
async def get_system_graph_stats():
    """Get statistics from the current system graph."""
    try:
        cyto = system_graph_engine.to_cytoscape_json()
        return {
            "node_count": cyto["stats"]["node_count"],
            "edge_count": cyto["stats"]["edge_count"],
            "central_concepts": cyto["stats"]["central_concepts"],
            "zone_summary": cyto["stats"]["zone_summary"],
            "type_summary": cyto["stats"]["type_summary"],
            "bottlenecks": cyto["stats"]["bottlenecks"],
        }
    except Exception as e:
        logger.error(f"Error getting system graph stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get("/system-graph/zones", response_model=dict)
async def get_system_zones():
    """Get zone utilization summary."""
    try:
        cyto = system_graph_engine.to_cytoscape_json()
        return cyto["stats"]["zone_summary"]
    except Exception as e:
        logger.error(f"Error getting zone summary: {e}")
        return {}
