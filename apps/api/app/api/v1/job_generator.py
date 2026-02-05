"""
Dynamic Job Generator API Endpoints

Provides REST API for autonomous job generation management and real-time streaming.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from supabase import Client

from app.services.supabase_service import supabase_service
from app.core.dynamic_job_generator import get_job_generator, DynamicJobGenerator, JobGenerationConfig

router = APIRouter(prefix="/job-generator", tags=["Job Generator"])


# Pydantic models for request/response
class GenerationConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    generation_interval_seconds: Optional[int] = Field(None, ge=5, le=3600)
    min_jobs: Optional[int] = Field(None, ge=0, le=100)
    max_jobs: Optional[int] = Field(None, ge=1, le=500)
    hot_lot_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    priority_distribution: Optional[Dict[str, float]] = None
    customer_weights: Optional[Dict[str, float]] = None
    recipe_types: Optional[List[str]] = None


class GenerationConfigResponse(BaseModel):
    enabled: bool
    generation_interval_seconds: int
    min_jobs: int
    max_jobs: int
    hot_lot_probability: float
    priority_distribution: Dict[str, float]
    customer_weights: Dict[str, float]
    recipe_types: List[str]


class GeneratorStatusResponse(BaseModel):
    running: bool
    total_generated: int
    last_generation: Optional[str]
    config: Dict[str, Any]


class JobCountsResponse(BaseModel):
    PENDING: int
    QUEUED: int
    RUNNING: int
    TOTAL: int


class GenerateJobResponse(BaseModel):
    success: bool
    job: Optional[Dict[str, Any]] = None
    message: str


def get_generator() -> DynamicJobGenerator:
    """Dependency to get the job generator instance."""
    return get_job_generator(supabase_service.client)


@router.get("/config", response_model=GenerationConfigResponse)
async def get_config(generator: DynamicJobGenerator = Depends(get_generator)):
    """Get current job generation configuration."""
    config = await generator.load_config()
    return GenerationConfigResponse(
        enabled=config.enabled,
        generation_interval_seconds=config.generation_interval_seconds,
        min_jobs=config.min_jobs,
        max_jobs=config.max_jobs,
        hot_lot_probability=config.hot_lot_probability,
        priority_distribution=config.priority_distribution,
        customer_weights=config.customer_weights,
        recipe_types=config.recipe_types
    )


@router.post("/config", response_model=GenerationConfigResponse)
async def update_config(
    request: GenerationConfigRequest,
    generator: DynamicJobGenerator = Depends(get_generator)
):
    """Update job generation configuration."""
    current_config = await generator.load_config()
    
    # Update only provided fields
    new_config = JobGenerationConfig(
        enabled=request.enabled if request.enabled is not None else current_config.enabled,
        generation_interval_seconds=request.generation_interval_seconds if request.generation_interval_seconds is not None else current_config.generation_interval_seconds,
        min_jobs=request.min_jobs if request.min_jobs is not None else current_config.min_jobs,
        max_jobs=request.max_jobs if request.max_jobs is not None else current_config.max_jobs,
        hot_lot_probability=request.hot_lot_probability if request.hot_lot_probability is not None else current_config.hot_lot_probability,
        priority_distribution=request.priority_distribution if request.priority_distribution is not None else current_config.priority_distribution,
        customer_weights=request.customer_weights if request.customer_weights is not None else current_config.customer_weights,
        recipe_types=request.recipe_types if request.recipe_types is not None else current_config.recipe_types
    )
    
    success = await generator.save_config(new_config)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save configuration")
    
    return GenerationConfigResponse(
        enabled=new_config.enabled,
        generation_interval_seconds=new_config.generation_interval_seconds,
        min_jobs=new_config.min_jobs,
        max_jobs=new_config.max_jobs,
        hot_lot_probability=new_config.hot_lot_probability,
        priority_distribution=new_config.priority_distribution,
        customer_weights=new_config.customer_weights,
        recipe_types=new_config.recipe_types
    )


@router.get("/status", response_model=GeneratorStatusResponse)
async def get_status(generator: DynamicJobGenerator = Depends(get_generator)):
    """Get job generator status and statistics."""
    stats = generator.get_stats()
    return GeneratorStatusResponse(**stats)


@router.post("/start")
async def start_generator(generator: DynamicJobGenerator = Depends(get_generator)):
    """Start the autonomous job generator."""
    if generator.is_running():
        return {"message": "Generator is already running"}
    
    generator.start()
    return {"message": "Job generator started successfully"}


@router.post("/stop")
async def stop_generator(generator: DynamicJobGenerator = Depends(get_generator)):
    """Stop the autonomous job generator."""
    if not generator.is_running():
        return {"message": "Generator is not running"}
    
    generator.stop()
    return {"message": "Job generator stopped successfully"}


@router.post("/generate", response_model=GenerateJobResponse)
async def generate_single_job(
    triggered_by: str = "manual",
    generator: DynamicJobGenerator = Depends(get_generator)
):
    """Manually trigger generation of a single job."""
    job = await generator.generate_job(triggered_by=triggered_by)
    
    if job:
        return GenerateJobResponse(
            success=True,
            job=job,
            message=f"Generated job: {job['job_name']}"
        )
    else:
        return GenerateJobResponse(
            success=False,
            message="Failed to generate job"
        )


@router.post("/generate-batch")
async def generate_batch(
    batch_size: int = 5,
    generator: DynamicJobGenerator = Depends(get_generator)
):
    """Generate a batch of jobs if needed."""
    generated = await generator.generate_jobs_if_needed(batch_size=batch_size)
    
    return {
        "generated": generated,
        "message": f"Generated {generated} jobs"
    }


@router.get("/counts", response_model=JobCountsResponse)
async def get_job_counts(generator: DynamicJobGenerator = Depends(get_generator)):
    """Get current job counts by status."""
    counts = await generator.get_current_job_count()
    return JobCountsResponse(**counts)


@router.get("/generation-log")
async def get_generation_log(
    limit: int = 50,
    reason: Optional[str] = None
):
    """Get job generation log with optional filtering."""
    query = supabase_service.client.table("job_generation_log") \
        .select("*, production_jobs(*)") \
        .order("created_at", desc=True) \
        .limit(limit)
    
    if reason:
        query = query.eq("generation_reason", reason)
    
    response = query.execute()
    return response.data or []


@router.post("/enable")
async def enable_generator(generator: DynamicJobGenerator = Depends(get_generator)):
    """Enable autonomous job generation."""
    config = await generator.load_config()
    config.enabled = True
    await generator.save_config(config)
    
    if not generator.is_running():
        generator.start()
    
    return {"message": "Job generation enabled"}


@router.post("/disable")
async def disable_generator(generator: DynamicJobGenerator = Depends(get_generator)):
    """Disable autonomous job generation."""
    config = await generator.load_config()
    config.enabled = False
    await generator.save_config(config)
    
    return {"message": "Job generation disabled"}


# Background task management
@router.on_event("startup")
async def startup_job_generator():
    """Start the job generator on application startup."""
    generator = get_job_generator(supabase_service.client)
    await generator.load_config()
    
    # Auto-start if enabled in config
    if generator.config.enabled:
        generator.start()


@router.on_event("shutdown")
async def shutdown_job_generator():
    """Stop the job generator on application shutdown."""
    generator = get_job_generator(supabase_service.client)
    generator.stop()