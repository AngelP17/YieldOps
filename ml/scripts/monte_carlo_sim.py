"""
Monte Carlo simulation for capacity planning.
"""
import numpy as np
import pandas as pd
from datetime import datetime
import json


def monte_carlo_capacity(
    n_machines=8,
    base_throughput=100,
    efficiency_mean=0.90,
    efficiency_std=0.05,
    downtime_prob=0.05,
    n_simulations=10000,
    time_horizon_days=30
):
    """
    Run Monte Carlo simulation for fab capacity planning.
    
    Returns:
        dict: Simulation results with statistics
    """
    results = []
    
    for _ in range(n_simulations):
        daily_outputs = []
        
        for day in range(time_horizon_days):
            # Simulate each machine
            day_output = 0
            
            for machine in range(n_machines):
                # Random efficiency
                efficiency = np.random.normal(efficiency_mean, efficiency_std)
                efficiency = np.clip(efficiency, 0.5, 1.0)
                
                # Random downtime
                is_down = np.random.random() < downtime_prob
                
                if not is_down:
                    # Calculate output
                    machine_output = base_throughput * efficiency
                    # Add some daily variation
                    machine_output *= np.random.normal(1.0, 0.02)
                    day_output += machine_output
            
            daily_outputs.append(day_output)
        
        # Total for this simulation
        total_output = sum(daily_outputs)
        results.append(total_output)
    
    # Statistics
    results = np.array(results)
    
    return {
        "mean_throughput": float(np.mean(results)),
        "std_throughput": float(np.std(results)),
        "p50": float(np.percentile(results, 50)),
        "p95": float(np.percentile(results, 95)),
        "p99": float(np.percentile(results, 99)),
        "p5": float(np.percentile(results, 5)),
        "confidence_interval": {
            "lower": float(np.percentile(results, 2.5)),
            "upper": float(np.percentile(results, 97.5))
        },
        "n_simulations": n_simulations,
        "time_horizon_days": time_horizon_days
    }


if __name__ == "__main__":
    results = monte_carlo_capacity(n_simulations=10000)
    print(json.dumps(results, indent=2))
