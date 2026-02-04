"""
Rust Monte Carlo Wrapper

Provides a Python interface to the Rust Monte Carlo simulation.
Falls back to the Python/NumPy implementation if Rust is unavailable.
"""

import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import Rust module
_RUST_AVAILABLE = False
_rust_mc = None

try:
    import yieldops_monte_carlo as _rust_mc
    _RUST_AVAILABLE = True
    logger.info("Rust Monte Carlo module loaded successfully")
except ImportError as e:
    logger.info(f"Rust Monte Carlo not available, using Python fallback: {e}")


def is_rust_available() -> bool:
    """Check if Rust Monte Carlo module is available."""
    return _RUST_AVAILABLE


@dataclass
class RustMachineConfig:
    """Machine configuration compatible with Rust module."""
    machine_id: str
    name: str
    base_throughput: float
    efficiency_mean: float
    efficiency_std: float
    downtime_prob: float
    repair_time_hours: float


@dataclass
class RustSimulationResult:
    """Simulation result from Rust module."""
    mean_throughput: float
    std_throughput: float
    p5: float
    p50: float
    p95: float
    p99: float
    confidence_interval: Dict[str, float]
    daily_throughputs: List[float]
    bottleneck_analysis: Dict[str, Any]


def run_simulation_rust(
    machines: List[RustMachineConfig],
    time_horizon_days: int = 30,
    n_simulations: int = 10000,
    random_seed: int = 42
) -> Optional[RustSimulationResult]:
    """
    Run Monte Carlo simulation using Rust backend.
    
    Args:
        machines: List of machine configurations
        time_horizon_days: Simulation period in days
        n_simulations: Number of Monte Carlo iterations
        random_seed: Random seed for reproducibility
    
    Returns:
        SimulationResult if Rust is available, None otherwise
    """
    if not _RUST_AVAILABLE or _rust_mc is None:
        return None
    
    try:
        # Convert to Rust types
        rust_machines = [
            _rust_mc.MachineConfig(
                m.machine_id,
                m.name,
                m.base_throughput,
                m.efficiency_mean,
                m.efficiency_std,
                m.downtime_prob,
                m.repair_time_hours
            )
            for m in machines
        ]
        
        # Create simulator and run
        simulator = _rust_mc.MonteCarloSimulator(random_seed)
        result = simulator.run_simulation(rust_machines, time_horizon_days, n_simulations)
        
        # Convert back to Python types
        return RustSimulationResult(
            mean_throughput=result.mean_throughput,
            std_throughput=result.std_throughput,
            p5=result.p5,
            p50=result.p50,
            p95=result.p95,
            p99=result.p99,
            confidence_interval={
                "lower": result.confidence_lower,
                "upper": result.confidence_upper
            },
            daily_throughputs=list(result.daily_throughputs),
            bottleneck_analysis={
                "top_bottleneck": result.bottleneck_machine,
                "machine_contributions": [
                    {"machine_id": m[0], "name": m[1], "expected_contribution": m[2]}
                    for m in result.machine_contributions
                ],
                "capacity_constraint": f"{result.bottleneck_machine} limits total capacity"
            }
        )
    except Exception as e:
        logger.error(f"Rust simulation failed: {e}")
        return None


class RustMonteCarloSimulator:
    """
    Wrapper class that matches the Python MonteCarloSimulator API.
    Uses Rust backend when available.
    """
    
    def __init__(self, random_seed: int = 42, use_rust: bool = True):
        self.random_seed = random_seed
        self.use_rust = use_rust and _RUST_AVAILABLE
        
        if self.use_rust:
            self._rust_simulator = _rust_mc.MonteCarloSimulator(random_seed)
        else:
            self._rust_simulator = None
    
    @property
    def backend(self) -> str:
        """Return the current backend being used."""
        return "rust" if self.use_rust else "python"
    
    def run_simulation(
        self,
        machines: List[Any],  # Accept both Python and Rust MachineConfig
        time_horizon_days: int = 30,
        n_simulations: int = 10000
    ) -> RustSimulationResult:
        """
        Run Monte Carlo simulation.
        
        Automatically uses Rust backend if available.
        """
        if not self.use_rust or self._rust_simulator is None:
            raise RuntimeError("Rust backend not available. Use Python MonteCarloSimulator instead.")
        
        # Convert machines if needed
        rust_machines = []
        for m in machines:
            if hasattr(m, 'machine_id'):
                # Already has required attributes
                rust_machines.append(
                    _rust_mc.MachineConfig(
                        getattr(m, 'machine_id', str(id(m))),
                        getattr(m, 'name', 'Unknown'),
                        getattr(m, 'base_throughput', 10.0),
                        getattr(m, 'efficiency_mean', 0.9),
                        getattr(m, 'efficiency_std', 0.05),
                        getattr(m, 'downtime_prob', 0.02),
                        getattr(m, 'repair_time_hours', 4.0)
                    )
                )
        
        result = self._rust_simulator.run_simulation(
            rust_machines, time_horizon_days, n_simulations
        )
        
        return RustSimulationResult(
            mean_throughput=result.mean_throughput,
            std_throughput=result.std_throughput,
            p5=result.p5,
            p50=result.p50,
            p95=result.p95,
            p99=result.p99,
            confidence_interval={
                "lower": result.confidence_lower,
                "upper": result.confidence_upper
            },
            daily_throughputs=list(result.daily_throughputs),
            bottleneck_analysis={
                "top_bottleneck": result.bottleneck_machine,
                "machine_contributions": [
                    {"machine_id": m[0], "name": m[1], "expected_contribution": m[2]}
                    for m in result.machine_contributions
                ],
                "capacity_constraint": f"{result.bottleneck_machine} limits total capacity"
            }
        )
