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


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
