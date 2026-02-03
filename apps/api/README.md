# YieldOps API

FastAPI backend for Smart Fab IIoT Manufacturing Execution System.

## Phase 4: Intelligence Layer

This phase implements the ML and analytics capabilities:

### Components

1. **Chaos Engineering API** (`app/api/v1/chaos.py`)
   - Inject controlled failures for resilience testing
   - Machine down simulation
   - Sensor anomaly spikes
   - Efficiency degradation

2. **Anomaly Detection** (`app/core/anomaly_detector.py`)
   - Isolation Forest ML model
   - Real-time anomaly scoring
   - Confidence levels (low/medium/high)
   - Auto-initialization with synthetic training data

3. **Monte Carlo Simulation** (`app/core/monte_carlo.py`)
   - Capacity planning simulations
   - Throughput forecasting with confidence intervals
   - Bottleneck identification
   - Scenario analysis

4. **Theory of Constraints Engine** (`app/core/toc_engine.py`)
   - Priority-based job dispatch
   - Hot lot handling
   - Efficiency-optimized machine selection

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/dispatch/run` | POST | Execute ToC dispatch |
| `/api/v1/dispatch/queue` | GET | View dispatch queue |
| `/api/v1/dispatch/history` | GET | Dispatch history |
| `/api/v1/machines` | GET | List machines |
| `/api/v1/machines/{id}` | GET | Machine details |
| `/api/v1/machines/{id}/stats` | GET | Machine statistics |
| `/api/v1/jobs` | GET | List jobs |
| `/api/v1/jobs/queue` | GET | Job queue |
| `/api/v1/chaos/inject` | POST | Inject failure |
| `/api/v1/chaos/recover/{id}` | POST | Recover machine |
| `/api/v1/chaos/scenarios` | GET | List chaos scenarios |
| `/api/v1/analytics/monte-carlo` | POST | Run simulation |
| `/api/v1/analytics/capacity-planning` | POST | Capacity analysis |
| `/api/v1/analytics/anomaly/detect` | POST | Detect anomaly |
| `/api/v1/analytics/anomaly/train` | POST | Train model |
| `/api/v1/analytics/bottlenecks` | GET | Identify bottlenecks |
| `/api/v1/analytics/dashboard` | GET | Dashboard summary |

### Running Locally

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the API
uvicorn app.main:app --reload

# API will be available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Environment Variables

```bash
SUPABASE_URL=https://vwayvxcvkozxumezwqio.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
DEBUG=true
PORT=8000
```

### Testing

```bash
# Run tests
pytest tests/

# Test health endpoint
curl http://localhost:8000/health

# Test chaos injection
curl -X POST http://localhost:8000/api/v1/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{"failure_type": "machine_down", "severity": "medium"}'

# Test anomaly detection
curl -X POST http://localhost:8000/api/v1/analytics/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{"machine_id": "test", "temperature": 85.0, "vibration": 4.5}'

# Test Monte Carlo simulation
curl -X POST http://localhost:8000/api/v1/analytics/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{"time_horizon_days": 30, "n_simulations": 1000}'
```

### Deployment

The API is configured for deployment on Koyeb:

```bash
# Using Koyeb CLI
koyeb app create yieldops-api \
  --git github.com/AngelP17/YieldOps \
  --git-branch main \
  --git-build-command "pip install -r requirements.txt" \
  --git-run-command "uvicorn app.main:app --host 0.0.0.0 --port 8000" \
  --git-workdir apps/api \
  --ports 8000:http \
  --instance-type nano
```

### Project Structure

```
app/
├── __init__.py
├── main.py                 # FastAPI application
├── config.py               # Configuration settings
├── api/
│   └── v1/
│       ├── __init__.py
│       ├── analytics.py    # Analytics & ML endpoints
│       ├── chaos.py        # Chaos engineering
│       ├── dispatch.py     # ToC dispatch
│       ├── jobs.py         # Job management
│       └── machines.py     # Machine management
├── core/
│   ├── __init__.py
│   ├── anomaly_detector.py # ML anomaly detection
│   ├── monte_carlo.py      # Monte Carlo simulation
│   └── toc_engine.py       # Theory of Constraints
├── models/
│   ├── __init__.py
│   └── schemas.py          # Pydantic schemas
└── services/
    ├── __init__.py
    └── supabase_service.py # Database service
```
