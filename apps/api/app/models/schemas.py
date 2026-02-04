"""
Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MachineStatus(str, Enum):
    """Machine status enum."""
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    DOWN = "DOWN"
    MAINTENANCE = "MAINTENANCE"


class MachineType(str, Enum):
    """Machine type enum."""
    LITHOGRAPHY = "lithography"
    ETCHING = "etching"
    DEPOSITION = "deposition"
    INSPECTION = "inspection"
    CLEANING = "cleaning"


class JobStatus(str, Enum):
    """Job status enum."""
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class MachineBase(BaseModel):
    """Base machine model."""
    name: str
    type: MachineType
    status: MachineStatus = MachineStatus.IDLE
    efficiency_rating: float = Field(..., ge=0.0, le=1.0)
    location_zone: str


class MachineCreate(MachineBase):
    """Machine creation model."""
    pass


class MachineResponse(MachineBase):
    """Machine response model."""
    machine_id: str
    current_wafer_count: int = 0
    total_wafers_processed: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobBase(BaseModel):
    """Base job model."""
    job_name: str
    wafer_count: int = Field(..., ge=1)
    priority_level: int = Field(default=3, ge=1, le=5)
    recipe_type: str
    is_hot_lot: bool = False


class JobCreate(JobBase):
    """Job creation model."""
    deadline: Optional[datetime] = None
    customer_tag: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None


class JobResponse(JobBase):
    """Job response model."""
    job_id: str
    status: JobStatus
    assigned_machine_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SensorReading(BaseModel):
    """Sensor reading model."""
    reading_id: str
    machine_id: str
    temperature: float
    vibration: float
    pressure: Optional[float] = None
    is_anomaly: bool = False
    recorded_at: datetime


class DispatchDecision(BaseModel):
    """Dispatch decision model."""
    decision_id: str
    job_id: str
    machine_id: str
    decision_reason: str
    dispatched_at: datetime


class MachineUpdate(BaseModel):
    """Machine update model."""
    status: Optional[MachineStatus] = None
    efficiency_rating: Optional[float] = Field(None, ge=0.0, le=1.0)


class MachineStats(BaseModel):
    """Machine statistics model."""
    machine_id: str
    name: str
    status: str
    efficiency_rating: float
    utilization_24h: float
    avg_temperature_24h: Optional[float] = None
    avg_vibration_24h: Optional[float] = None
    anomaly_count_24h: int
    recent_readings: List[dict] = []


class DispatchRequest(BaseModel):
    """Dispatch request model."""
    max_dispatches: int = Field(default=10, ge=1, le=100)
    priority_filter: Optional[int] = Field(None, ge=1, le=5)


class DispatchDecisionResponse(BaseModel):
    """Dispatch decision response model."""
    decision_id: str
    job_id: str
    machine_id: str
    machine_name: str
    reason: str
    dispatched_at: datetime


class DispatchBatchResponse(BaseModel):
    """Dispatch batch response model."""
    decisions: List[DispatchDecisionResponse]
    total_dispatched: int
    algorithm_version: str


# Alias for compatibility
ProductionJobResponse = JobResponse
ProductionJobCreate = JobCreate


class ProductionJobUpdate(BaseModel):
    """Production job update model."""
    status: Optional[JobStatus] = None
    assigned_machine_id: Optional[str] = None


class JobQueueItem(BaseModel):
    """Job queue item model."""
    job_id: str
    job_name: str
    priority_level: int
    is_hot_lot: bool
    status: str
    created_at: datetime


class SensorReadingResponse(BaseModel):
    """Sensor reading response model."""
    reading_id: str
    machine_id: str
    temperature: float
    vibration: float
    pressure: Optional[float] = None
    is_anomaly: bool
    recorded_at: datetime


class ChaosInjectRequest(BaseModel):
    """Chaos injection request model."""
    failure_type: str
    machine_id: Optional[str] = None
    duration_seconds: int = Field(default=300, ge=30, le=3600)
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")


class MonteCarloRequest(BaseModel):
    """Monte Carlo simulation request model."""
    n_simulations: int = Field(default=1000, ge=100, le=50000)
    time_horizon_days: int = Field(default=30, ge=1, le=365)
    base_throughput: float = Field(default=100.0, ge=1.0)
    efficiency_mean: float = Field(default=0.90, ge=0.0, le=1.0)
    efficiency_std: float = Field(default=0.05, ge=0.0, le=0.5)
    downtime_prob: float = Field(default=0.05, ge=0.0, le=1.0)


class MonteCarloResponse(BaseModel):
    """Monte Carlo simulation response model."""
    simulation_config: dict
    results: dict


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str


# =====================================================
# Virtual Metrology Schemas
# =====================================================

class VMPredictionRequest(BaseModel):
    """VM prediction request."""
    tool_id: str
    lot_id: str
    temperature: float
    pressure: float = 0.0
    power_consumption: float = Field(default=0.0, description="Power consumption (proxy for RF power)")


class VMPredictionResponse(BaseModel):
    """VM prediction response."""
    lot_id: str
    tool_id: str
    predicted_thickness_nm: float
    confidence_score: float
    r2r_correction: float
    prediction_id: Optional[str] = None


class VMFeedbackRequest(BaseModel):
    """Feedback with actual metrology result for R2R update."""
    prediction_id: str
    actual_thickness_nm: float


class VMFeedbackResponse(BaseModel):
    """Response from feedback endpoint."""
    prediction_error: float
    ewma_error: float
    recipe_adjustment: Optional[dict] = None


class VMTrainRequest(BaseModel):
    """Request to train/retrain VM model."""
    min_samples: int = Field(default=50, ge=20)


class VMTrainResponse(BaseModel):
    """Training result."""
    trained: bool
    samples: int
    features: List[str]
    r2_mean: float
    r2_std: float
    coefficients: Optional[dict] = None
