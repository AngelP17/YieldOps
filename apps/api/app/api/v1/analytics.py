from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging

from app.services.supabase_service import supabase_service
from app.core.monte_carlo import mc_simulator, MachineConfig

router = APIRouter()
logger = logging.getLogger(__name__)


class MonteCarloRequest(BaseModel):
    n_simulations: int = 1000
    time_horizon_days: int = 30
    base_throughput: float = 100
    efficiency_mean: float = 0.90
    efficiency_std: float = 0.05
    downtime_prob: float = 0.05


@router.get("/throughput")
async def get_throughput_analytics(days: int = 7):
    """Get throughput analytics for the last N days."""
    try:
        analytics = await supabase_service.get_throughput_analytics(days)
        return {
            "period_days": days,
            "analytics": analytics
        }
    except Exception as e:
        logger.error(f"Error fetching analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/machine-stats")
async def get_machine_statistics():
    """Get overall machine statistics."""
    try:
        stats = await supabase_service.get_machine_statistics()
        return stats
    except Exception as e:
        logger.error(f"Error fetching machine stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/monte-carlo")
async def run_monte_carlo(request: MonteCarloRequest):
    """
    Run Monte Carlo simulation for capacity planning.
    
    Simulates fab operations to predict:
    - Expected throughput
    - Confidence intervals
    - Bottleneck identification
    """
    try:
        # Get machines from database
        machines_data = await supabase_service.get_machines()
        
        if not machines_data:
            raise HTTPException(status_code=400, detail="No machines found for simulation")
        
        # Convert to MachineConfig
        machines = [
            MachineConfig(
                machine_id=m["machine_id"],
                name=m["name"],
                base_throughput=request.base_throughput,
                efficiency_mean=request.efficiency_mean,
                efficiency_std=request.efficiency_std,
                downtime_prob=request.downtime_prob,
                repair_time_hours=4.0
            )
            for m in machines_data
        ]
        
        # Run simulation
        result = mc_simulator.run_simulation(
            machines=machines,
            time_horizon_days=request.time_horizon_days,
            n_simulations=request.n_simulations
        )
        
        return {
            "simulation_config": {
                "n_simulations": request.n_simulations,
                "time_horizon_days": request.time_horizon_days,
                "n_machines": len(machines)
            },
            "results": {
                "mean_throughput": result.mean_throughput,
                "std_throughput": result.std_throughput,
                "p5": result.p5,
                "p50": result.p50,
                "p95": result.p95,
                "p99": result.p99,
                "confidence_interval": result.confidence_interval,
                "daily_throughputs": result.daily_throughputs,
                "bottleneck_analysis": result.bottleneck_analysis
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Monte Carlo simulation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies")
async def get_anomaly_stats(days: int = 7):
    """Get anomaly detection statistics."""
    try:
        stats = await supabase_service.get_anomaly_stats(days)
        return {
            "period_days": days,
            "anomaly_stats": stats
        }
    except Exception as e:
        logger.error(f"Error fetching anomaly stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
