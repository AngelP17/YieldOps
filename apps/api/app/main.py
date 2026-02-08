"""
YieldOps API - Main Application

FastAPI application for Smart Fab IIoT Manufacturing Execution System.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import routers
from app.api.v1 import dispatch, machines, jobs, chaos, analytics, vm, scheduler, simulation, aegis, graphs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting up YieldOps API...")
    
    # Initialize ML models
    try:
        from app.core.anomaly_detector import initialize_model
        initialize_model()
        logger.info("Anomaly detection model initialized")
    except Exception as e:
        logger.warning(f"Could not initialize anomaly model: {e}")

    # Initialize VM model
    try:
        from app.core.vm_engine import vm_engine
        vm_engine.load_model()
        logger.info("VM model loaded (if available)")
    except Exception as e:
        logger.warning(f"Could not initialize VM model: {e}")

    yield
    
    logger.info("Shutting down YieldOps API...")


# Create FastAPI app
app = FastAPI(
    title="YieldOps API",
    description="IIoT Manufacturing Execution System API for Smart Fab",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yield-ops-dashboard.vercel.app",
        "https://yieldops.vercel.app",
        "https://yieldops-dashboard.vercel.app",
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # React dev server
    ],
    allow_origin_regex=r"https://yield-ops-dashboard-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dispatch.router, prefix="/api/v1/dispatch", tags=["dispatch"])
app.include_router(machines.router, prefix="/api/v1/machines", tags=["machines"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(chaos.router, prefix="/api/v1/chaos", tags=["chaos"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(vm.router, prefix="/api/v1/vm", tags=["virtual-metrology"])
app.include_router(scheduler.router, prefix="/api/v1", tags=["scheduler"])
app.include_router(simulation.router, prefix="/api/v1/simulation", tags=["simulation"])
app.include_router(aegis.router, prefix="/api/v1/aegis", tags=["aegis-sentinel"])
app.include_router(graphs.router, prefix="/api/v1/graphs", tags=["knowledge-graphs"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "yieldops-api",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "YieldOps API",
        "description": "IIoT Manufacturing Execution System",
        "docs": "/docs",
        "version": "1.0.0",
        "endpoints": {
            "dispatch": "/api/v1/dispatch",
            "machines": "/api/v1/machines",
            "jobs": "/api/v1/jobs",
            "chaos": "/api/v1/chaos",
            "analytics": "/api/v1/analytics",
            "vm": "/api/v1/vm",
            "scheduler": "/api/v1/scheduler",
            "aegis": "/api/v1/aegis",
            "graphs": "/api/v1/graphs"
        }
    }


@app.get("/api/v1/system/stats")
async def system_stats():
    """Get overall system statistics."""
    try:
        from app.services.supabase_service import supabase_service
        
        machines = await supabase_service.get_machines()
        jobs = await supabase_service.get_pending_jobs()
        
        total = len(machines)
        running = len([m for m in machines if m.get("status") == "RUNNING"])
        idle = len([m for m in machines if m.get("status") == "IDLE"])
        down = len([m for m in machines if m.get("status") == "DOWN"])
        
        avg_efficiency = sum(m.get("efficiency_rating", 0) for m in machines) / total if total else 0
        
        return {
            "total_machines": total,
            "running_machines": running,
            "idle_machines": idle,
            "down_machines": down,
            "pending_jobs": len(jobs),
            "completed_jobs_24h": 0,  # Would query actual data
            "avg_efficiency": round(avg_efficiency, 2),
            "total_throughput_24h": 0  # Would query actual data
        }
    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        return {
            "error": str(e),
            "total_machines": 0,
            "pending_jobs": 0
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
