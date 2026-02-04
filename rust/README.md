# YieldOps Rust Modules

High-performance Rust extensions for YieldOps semiconductor fab simulation.

## Modules

### Monte Carlo Simulation (`monte_carlo/`)

- **10-50x speedup** over Python/NumPy for 10k+ iterations
- Parallel execution using `rayon`
- P5/P50/P95/P99 confidence intervals

### Scheduler Optimizer (`scheduler/`)

- Constraint-based job-to-machine assignment
- Recipe type compatibility
- Deadline and priority awareness
- Multi-objective scoring

## Building

### Prerequisites

```bash
# Install maturin
pip install maturin

# Ensure Rust is installed
rustc --version
```

### Build Python Wheels

```bash
cd rust

# For development (in-place)
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 maturin develop --release

# For distribution
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 maturin build --release
```

> **Note**: `PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1` is required for Python 3.14+

### Running Tests

```bash
# Rust unit tests (currently require Python linking fix for 3.14)
cargo test --all

# Check compilation
cargo check --all
```

## Usage from Python

```python
# Monte Carlo (automatic Rust backend)
from app.core.monte_carlo import MonteCarloSimulator

sim = MonteCarloSimulator(use_rust=True)
result = sim.run_simulation(machines, time_horizon_days=30, n_simulations=10000)
print(f"P95: {result.p95}, Backend: {sim.backend}")

# Scheduler Optimizer
from app.core.scheduler_optimizer import SchedulerOptimizer

optimizer = SchedulerOptimizer()
result = optimizer.optimize(jobs, machines, max_assignments=10)
print(f"Assigned {len(result.assignments)} jobs using {optimizer.backend}")
```

## Performance

Expected speedup with Rust backend:

| Simulations | Python Time | Rust Time | Speedup |
|-------------|-------------|-----------|---------|
| 1,000       | ~0.5s       | ~0.05s    | 10x     |
| 10,000      | ~5s         | ~0.1s     | 50x     |
| 100,000     | ~50s        | ~1s       | 50x     |
