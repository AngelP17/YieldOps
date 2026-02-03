"""
Monte Carlo Simulation for Fab Capacity Planning

Simulates fab operations over time to predict:
- Expected throughput
- Confidence intervals
- Bottleneck identification
- Impact of machine failures
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class MachineConfig:
    machine_id: str
    name: str
    base_throughput: float  # wafers per hour
    efficiency_mean: float
    efficiency_std: float
    downtime_prob: float
    repair_time_hours: float


@dataclass
class SimulationResult:
    mean_throughput: float
    std_throughput: float
    p5: float
    p50: float
    p95: float
    p99: float
    confidence_interval: Dict[str, float]
    daily_throughputs: List[float]
    bottleneck_analysis: Dict


class MonteCarloSimulator:
    """
    Monte Carlo simulation for semiconductor fab capacity planning.
    
    Models:
    - Machine efficiency variation
    - Random downtime events
    - Repair times
    - Throughput aggregation
    """
    
    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed
        np.random.seed(random_seed)
    
    def run_simulation(
        self,
        machines: List[MachineConfig],
        time_horizon_days: int = 30,
        n_simulations: int = 10000
    ) -> SimulationResult:
        """
        Run Monte Carlo simulation.
        
        Args:
            machines: List of machine configurations
            time_horizon_days: Simulation period
            n_simulations: Number of Monte Carlo iterations
        
        Returns:
            SimulationResult with statistics
        """
        all_simulations = []
        daily_breakdown = [[] for _ in range(time_horizon_days)]
        
        for sim_idx in range(n_simulations):
            simulation_total = 0
            
            for day in range(time_horizon_days):
                day_output = 0
                
                for machine in machines:
                    # Check for downtime
                    is_down = np.random.random() < machine.downtime_prob
                    
                    if is_down:
                        # Machine is down for repair
                        continue
                    
                    # Normal operation with efficiency variation
                    efficiency = np.random.normal(
                        machine.efficiency_mean,
                        machine.efficiency_std
                    )
                    efficiency = np.clip(efficiency, 0.3, 1.0)
                    
                    # Daily output (24 hours)
                    daily_output = machine.base_throughput * efficiency * 24
                    
                    # Add small daily variation
                    daily_output *= np.random.normal(1.0, 0.02)
                    
                    day_output += daily_output
                
                simulation_total += day_output
                daily_breakdown[day].append(day_output)
            
            all_simulations.append(simulation_total)
        
        # Calculate statistics
        all_simulations = np.array(all_simulations)
        daily_means = [np.mean(day) for day in daily_breakdown]
        
        # Bottleneck analysis
        machine_contributions = []
        for machine in machines:
            contrib = machine.base_throughput * machine.efficiency_mean * 24 * time_horizon_days
            machine_contributions.append({
                "machine_id": machine.machine_id,
                "name": machine.name,
                "expected_contribution": contrib
            })
        
        machine_contributions.sort(key=lambda x: x["expected_contribution"], reverse=True)
        
        return SimulationResult(
            mean_throughput=float(np.mean(all_simulations)),
            std_throughput=float(np.std(all_simulations)),
            p5=float(np.percentile(all_simulations, 5)),
            p50=float(np.percentile(all_simulations, 50)),
            p95=float(np.percentile(all_simulations, 95)),
            p99=float(np.percentile(all_simulations, 99)),
            confidence_interval={
                "lower": float(np.percentile(all_simulations, 2.5)),
                "upper": float(np.percentile(all_simulations, 97.5))
            },
            daily_throughputs=daily_means,
            bottleneck_analysis={
                "top_bottleneck": machine_contributions[-1]["name"],
                "machine_contributions": machine_contributions,
                "capacity_constraint": f"{machine_contributions[-1]['name']} limits total capacity"
            }
        )
    
    def scenario_analysis(
        self,
        base_machines: List[MachineConfig],
        scenarios: List[Dict],
        time_horizon_days: int = 30,
        n_simulations: int = 5000
    ) -> Dict:
        """
        Compare multiple scenarios.
        
        Scenarios might include:
        - Adding new machines
        - Improving efficiency
        - Reducing downtime
        """
        results = {}
        
        # Base case
        base_result = self.run_simulation(base_machines, time_horizon_days, n_simulations)
        results["base_case"] = base_result
        
        # Scenario comparisons
        for scenario in scenarios:
            modified_machines = self._apply_scenario(base_machines, scenario)
            scenario_result = self.run_simulation(
                modified_machines, 
                time_horizon_days, 
                n_simulations
            )
            
            improvement = (
                (scenario_result.mean_throughput - base_result.mean_throughput)
                / base_result.mean_throughput * 100
            )
            
            results[scenario["name"]] = {
                "result": scenario_result,
                "improvement_percent": improvement
            }
        
        return results
    
    def _apply_scenario(
        self, 
        machines: List[MachineConfig], 
        scenario: Dict
    ) -> List[MachineConfig]:
        """Apply scenario modifications to machine configs."""
        modified = []
        
        for m in machines:
            new_m = MachineConfig(
                machine_id=m.machine_id,
                name=m.name,
                base_throughput=m.base_throughput * scenario.get("throughput_multiplier", 1.0),
                efficiency_mean=min(1.0, m.efficiency_mean * scenario.get("efficiency_multiplier", 1.0)),
                efficiency_std=m.efficiency_std,
                downtime_prob=m.downtime_prob * scenario.get("downtime_multiplier", 1.0),
                repair_time_hours=m.repair_time_hours
            )
            modified.append(new_m)
        
        # Add new machines if specified
        for new_machine in scenario.get("add_machines", []):
            modified.append(MachineConfig(**new_machine))
        
        return modified


# Singleton instance
mc_simulator = MonteCarloSimulator()
