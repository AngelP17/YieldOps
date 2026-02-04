"""
Virtual Metrology API Routes

Endpoints for VM predictions, R2R feedback, and model training.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import logging
import uuid

from app.core.vm_engine import vm_engine
from app.services.supabase_service import supabase_service

router = APIRouter()
logger = logging.getLogger(__name__)


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
    prediction_id: str


class VMFeedbackRequest(BaseModel):
    """Feedback with actual metrology result for R2R update."""
    prediction_id: str
    actual_thickness_nm: float


class VMFeedbackResponse(BaseModel):
    """Response from feedback endpoint."""
    prediction_id: str
    prediction_error: float
    ewma_error: float
    recipe_adjustment: Optional[dict] = None


class VMModelInfoResponse(BaseModel):
    """VM model information."""
    is_trained: bool
    features: List[str]
    ewma_tracked_tools: int
    model_path: str


class VMStatusResponse(BaseModel):
    """VM status for a machine."""
    machine_id: str
    has_prediction: bool
    predicted_thickness_nm: Optional[float] = None
    confidence_score: Optional[float] = None
    r2r_correction: Optional[float] = None
    ewma_error: Optional[float] = None
    needs_correction: Optional[bool] = None
    last_updated: Optional[str] = None
    message: Optional[str] = None


class VMHistoryResponse(BaseModel):
    """VM history for a machine."""
    machine_id: str
    history: List[Dict]
    trend: str
    avg_thickness: float
    std_thickness: float


@router.post("/predict", response_model=VMPredictionResponse)
async def predict_thickness(request: VMPredictionRequest):
    """
    Predict film thickness using Virtual Metrology.
    
    Uses Ridge regression model with R2R correction based on EWMA.
    """
    try:
        features = {
            "tool_id": request.tool_id,
            "temperature": request.temperature,
            "pressure": request.pressure,
            "power_consumption": request.power_consumption,
        }
        
        result = vm_engine.predict(features)
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        # Generate prediction ID
        prediction_id = str(uuid.uuid4())
        
        return VMPredictionResponse(
            lot_id=request.lot_id,
            tool_id=request.tool_id,
            predicted_thickness_nm=result["predicted_thickness_nm"] or 0.0,
            confidence_score=result["confidence_score"],
            r2r_correction=result["r2r_correction"],
            prediction_id=prediction_id,
        )
    except Exception as e:
        logger.error(f"VM prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/feedback", response_model=VMFeedbackResponse)
async def submit_feedback(request: VMFeedbackRequest):
    """
    Submit actual metrology result for R2R correction.
    
    Updates EWMA error and returns recipe adjustment if drift exceeds threshold.
    """
    try:
        # For now, we use the prediction_id as a proxy for tool_id
        # In production, you'd look up the prediction to get the tool_id and predicted value
        # Here we use the EWMA update directly
        
        # Mock: use prediction_id to derive tool_id (first 8 chars)
        tool_id = request.prediction_id[:8]
        
        # Get the current prediction for this tool (mock - in production fetch from DB)
        predicted = request.actual_thickness_nm + 0.5  # Mock predicted value
        
        result = vm_engine.update_ewma(
            tool_id=tool_id,
            actual=request.actual_thickness_nm,
            predicted=predicted,
        )
        
        return VMFeedbackResponse(
            prediction_id=request.prediction_id,
            prediction_error=result["current_error"],
            ewma_error=result["ewma_error"],
            recipe_adjustment=result.get("recipe_adjustment"),
        )
    except Exception as e:
        logger.error(f"VM feedback failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Feedback failed: {str(e)}")


@router.get("/predictions/{tool_id}")
async def get_predictions(tool_id: str, limit: int = 50):
    """Get recent VM predictions for a tool."""
    try:
        # Mock predictions - in production, fetch from database
        import random
        predictions = []
        for i in range(min(limit, 10)):
            predictions.append({
                "prediction_id": str(uuid.uuid4()),
                "lot_id": f"LOT-{1000 + i}",
                "tool_id": tool_id,
                "predicted_thickness_nm": 50.0 + random.uniform(-2, 2),
                "confidence_score": 0.85 + random.uniform(0, 0.14),
                "model_version": "1.0.0",
                "created_at": "2024-01-01T00:00:00Z",
            })
        return predictions
    except Exception as e:
        logger.error(f"Failed to get predictions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get predictions: {str(e)}")


@router.get("/adjustments/{tool_id}")
async def get_adjustments(tool_id: str, limit: int = 20):
    """Get recipe adjustments for a tool."""
    try:
        # Mock adjustments - in production, fetch from database
        adjustments = []
        if tool_id in vm_engine.ewma_error and abs(vm_engine.ewma_error[tool_id]) > 1.0:
            adjustments.append({
                "adjustment_id": str(uuid.uuid4()),
                "tool_id": tool_id,
                "parameter_name": "temperature",
                "current_value": 65.0,
                "adjustment_value": -vm_engine.ewma_error[tool_id] / 0.5,
                "new_value": 65.0 - vm_engine.ewma_error[tool_id] / 0.5,
                "reason": f"EWMA drift correction: {vm_engine.ewma_error[tool_id]:.2f}nm systematic error",
                "applied": False,
                "created_at": "2024-01-01T00:00:00Z",
            })
        return adjustments
    except Exception as e:
        logger.error(f"Failed to get adjustments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get adjustments: {str(e)}")


@router.get("/model/info", response_model=VMModelInfoResponse)
async def get_model_info():
    """Get VM model information and training status."""
    info = vm_engine.get_model_info()
    return VMModelInfoResponse(**info)


@router.post("/model/train")
async def train_model():
    """
    Train VM model on historical data.
    
    Fetches joined sensor readings and metrology results from database.
    """
    try:
        training_data = await supabase_service.get_training_data()
        
        if not training_data or len(training_data) < 20:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient training data. Need at least 20 samples, got {len(training_data) if training_data else 0}"
            )
        
        result = vm_engine.train(training_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Model training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.get("/status/{machine_id}", response_model=VMStatusResponse)
async def get_vm_status(machine_id: str):
    """
    Get current VM status for a machine.
    
    Includes latest prediction, EWMA state, and R2R correction status.
    """
    try:
        # Get latest sensor reading
        latest_reading = await supabase_service.get_latest_sensor_reading(machine_id)
        
        if not latest_reading:
            return VMStatusResponse(
                machine_id=machine_id,
                has_prediction=False,
                message="No sensor data available",
            )
        
        # Make prediction
        features = {
            "tool_id": machine_id,
            "temperature": latest_reading.get("temperature", 0),
            "pressure": latest_reading.get("pressure", 0),
            "power_consumption": latest_reading.get("power_consumption", 0),
        }
        
        prediction = vm_engine.predict(features)
        
        # Get EWMA state
        ewma_error = vm_engine.ewma_error.get(machine_id, 0.0)
        
        return VMStatusResponse(
            machine_id=machine_id,
            has_prediction=prediction.get("predicted_thickness_nm") is not None,
            predicted_thickness_nm=prediction.get("predicted_thickness_nm"),
            confidence_score=prediction.get("confidence_score"),
            r2r_correction=prediction.get("r2r_correction"),
            ewma_error=ewma_error,
            needs_correction=abs(ewma_error) > 1.0,
            last_updated=latest_reading.get("recorded_at"),
        )
    except Exception as e:
        logger.error(f"Failed to get VM status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/history/{machine_id}", response_model=VMHistoryResponse)
async def get_vm_history(machine_id: str, hours: int = 24):
    """
    Get VM prediction history for a machine.
    
    Returns historical predictions with trend analysis.
    """
    try:
        # Fetch sensor readings with predictions from database
        readings = await supabase_service.get_sensor_readings(
            machine_id=machine_id,
            hours=hours,
            include_predictions=True
        )
        
        if not readings:
            return VMHistoryResponse(
                machine_id=machine_id,
                history=[],
                trend="stable",
                avg_thickness=0.0,
                std_thickness=0.0,
            )
        
        # Calculate trend
        thickness_values = [r.get("predicted_thickness_nm", 0) for r in readings if r.get("predicted_thickness_nm")]
        
        if len(thickness_values) < 2:
            trend = "stable"
        else:
            # Simple trend: compare first half vs second half
            mid = len(thickness_values) // 2
            first_half = sum(thickness_values[:mid]) / max(1, mid)
            second_half = sum(thickness_values[mid:]) / max(1, len(thickness_values) - mid)
            
            diff = second_half - first_half
            if abs(diff) < 0.5:
                trend = "stable"
            elif diff > 0:
                trend = "increasing"
            else:
                trend = "decreasing"
        
        avg_thickness = sum(thickness_values) / len(thickness_values) if thickness_values else 0.0
        
        # Calculate standard deviation
        if len(thickness_values) > 1:
            variance = sum((x - avg_thickness) ** 2 for x in thickness_values) / len(thickness_values)
            std_thickness = variance ** 0.5
        else:
            std_thickness = 0.0
        
        return VMHistoryResponse(
            machine_id=machine_id,
            history=readings,
            trend=trend,
            avg_thickness=round(avg_thickness, 2),
            std_thickness=round(std_thickness, 2),
        )
    except Exception as e:
        logger.error(f"Failed to fetch VM history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")
