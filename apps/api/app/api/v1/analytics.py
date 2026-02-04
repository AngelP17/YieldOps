from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging

from app.services.supabase_service import supabase_service
from app.core.monte_carlo import mc_simulator, MachineConfig
from app.core.rust_monte_carlo import (
    is_rust_available, 
    RustMonteCarloSimulator,
    RustMachineConfig
)

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
    
    Uses Rust backend when available for 10-50x performance improvement.
    """
    try:
        # Get machines from database
        machines_data = await supabase_service.get_machines()
        
        if not machines_data:
            raise HTTPException(status_code=400, detail="No machines found for simulation")
        
        # Try Rust backend first
        if is_rust_available():
            logger.info(f"Using Rust Monte Carlo backend ({request.n_simulations} simulations)")
            rust_machines = [
                RustMachineConfig(
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
            
            rust_sim = RustMonteCarloSimulator(random_seed=42, use_rust=True)
            result = rust_sim.run_simulation(
                machines=rust_machines,
                time_horizon_days=request.time_horizon_days,
                n_simulations=request.n_simulations
            )
            backend = "rust"
        else:
            # Fall back to Python/NumPy
            logger.info(f"Using Python Monte Carlo backend ({request.n_simulations} simulations)")
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
            
            result = mc_simulator.run_simulation(
                machines=machines,
                time_horizon_days=request.time_horizon_days,
                n_simulations=request.n_simulations
            )
            backend = "python"
        
        return {
            "simulation_config": {
                "n_simulations": request.n_simulations,
                "time_horizon_days": request.time_horizon_days,
                "n_machines": len(machines_data),
                "backend": backend
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


@router.get("/rust-status")
async def get_rust_status():
    """Get Rust module availability and performance info."""
    try:
        rust_available = is_rust_available()
        
        # Run a quick benchmark if Rust is available
        benchmark = None
        if rust_available:
            import yieldops_monte_carlo as mc
            import time
            
            sim = mc.MonteCarloSimulator(42)
            machines = [
                mc.MachineConfig('M1', 'Test Machine 1', 100.0, 0.9, 0.05, 0.02, 4.0),
                mc.MachineConfig('M2', 'Test Machine 2', 80.0, 0.85, 0.08, 0.03, 6.0),
            ]
            
            start = time.perf_counter()
            result = sim.run_simulation(machines, 7, 1000)
            elapsed_ms = (time.perf_counter() - start) * 1000
            
            benchmark = {
                "test_simulations": 1000,
                "test_time_ms": round(elapsed_ms, 2),
                "test_throughput": round(1000 / elapsed_ms * 1000, 0) if elapsed_ms > 0 else 0
            }
        
        return {
            "rust_available": rust_available,
            "modules": {
                "yieldops_monte_carlo": rust_available,
                "yieldops_scheduler": rust_available
            },
            "performance": benchmark,
            "message": "Rust modules active - 10-50x performance improvement" if rust_available else "Using Python fallback"
        }
    except Exception as e:
        logger.error(f"Error checking Rust status: {str(e)}")
        return {
            "rust_available": False,
            "error": str(e),
            "message": "Rust modules not available"
        }
