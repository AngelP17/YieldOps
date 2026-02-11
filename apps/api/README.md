# YieldOps API

FastAPI backend for Smart Fab IIoT Manufacturing Execution System.

> Note: This API is optional for portfolio/demo deployments. The frontend dashboard can run fully in demo mode without deploying this backend.

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

5. **Aegis Sentinel Integration** (`app/api/v1/aegis.py`, `app/core/sentinel_engine.py`)
   - Incident management for sentinel agents
   - 3-tier Safety Circuit (Green/Yellow/Red zones)
   - Agent registry and heartbeat
   - Knowledge graph generation

6. **Knowledge Graph** (`app/api/v1/graphs.py`, `app/core/knowledge_graph_engine.py`)
   - NetworkX-based graph analytics
   - Concept extraction from incidents
   - Jobs, system, and overview graph endpoints

---

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/machines` | GET | List machines |
| `/api/v1/machines/{id}` | GET | Machine details |
| `/api/v1/machines/{id}/stats` | GET | Machine statistics |
| `/api/v1/jobs` | GET/POST | List/Create jobs |
| `/api/v1/jobs/queue` | GET | Job queue |
| `/api/v1/jobs/{id}/cancel` | POST | Cancel job |
| `/api/v1/dispatch/run` | POST | Execute ToC dispatch |
| `/api/v1/dispatch/queue` | GET | View dispatch queue |
| `/api/v1/dispatch/history` | GET | Dispatch history |

### Analytics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/monte-carlo` | POST | Run Monte Carlo simulation |
| `/api/v1/analytics/capacity-planning` | POST | Capacity analysis |
| `/api/v1/analytics/anomaly/detect` | POST | Detect anomaly |
| `/api/v1/analytics/anomaly/train` | POST | Train model |
| `/api/v1/analytics/bottlenecks` | GET | Identify bottlenecks |
| `/api/v1/analytics/dashboard` | GET | Dashboard summary |

### VM (Virtual Metrology) Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/vm/status/{id}` | GET | Get VM status for machine |
| `/api/v1/vm/history/{id}` | GET | Get VM history (24h) |
| `/api/v1/vm/predict` | POST | Request VM prediction |
| `/api/v1/vm/model/info` | GET | Get VM model info |

### Chaos Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/chaos/inject` | POST | Inject failure |
| `/api/v1/chaos/recover/{id}` | POST | Recover machine |
| `/api/v1/chaos/scenarios` | GET | List chaos scenarios |

### Simulation Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/simulation/tick` | POST | Run one simulation tick |
| `/api/v1/simulation/fast` | POST | Fast forward (multiple ticks) |
| `/api/v1/simulation/status` | GET | Get job/machine counts |
| `/api/v1/simulation/reset` | POST | Reset to initial distribution |

### Aegis Sentinel Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/aegis/incidents` | GET | List all incidents |
| `/api/v1/aegis/incidents` | POST | Report incident from agent |
| `/api/v1/aegis/incidents/{id}` | GET | Get incident details |
| `/api/v1/aegis/incidents/{id}/approve` | POST | Approve yellow zone action |
| `/api/v1/aegis/incidents/{id}/resolve` | POST | Resolve incident |
| `/api/v1/aegis/agents` | GET | List all agents |
| `/api/v1/aegis/agents/register` | POST | Register new agent |
| `/api/v1/aegis/agents/{id}/heartbeat` | POST | Update agent heartbeat |
| `/api/v1/aegis/safety-circuit` | GET | Get safety circuit status |
| `/api/v1/aegis/summary` | GET | Get sentinel summary |
| `/api/v1/aegis/knowledge-graph` | GET | Get knowledge graph |
| `/api/v1/aegis/knowledge-graph/generate` | POST | Generate from incidents |
| `/api/v1/aegis/knowledge-graph/stats` | GET | Get graph statistics |
| `/api/v1/aegis/telemetry/analyze` | POST | Analyze telemetry |

### Knowledge Graph Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/graphs/jobs` | GET | Get jobs knowledge graph |
| `/api/v1/graphs/system` | GET | Get system knowledge graph |
| `/api/v1/graphs/overview` | GET | Get overview knowledge graph |

---

## Running Locally

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

---

## Environment Variables (Optional for Live Integrations)

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
DEBUG=true
AUTO_INIT_MODEL=true
```

---

## Testing

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

# Test Aegis incident reporting
curl -X POST http://localhost:8000/api/v1/aegis/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "TEST-001",
    "severity": "high",
    "incident_type": "thermal_runaway",
    "message": "Test incident",
    "detected_value": 95.0,
    "threshold_value": 80.0,
    "recommended_action": "reduce_thermal_load",
    "action_zone": "yellow",
    "agent_type": "precision",
    "z_score": 3.5,
    "rate_of_change": 10.0
  }'

# Get Aegis summary
curl http://localhost:8000/api/v1/aegis/summary

# Generate knowledge graph
curl -X POST http://localhost:8000/api/v1/aegis/knowledge-graph/generate \
  -H "Content-Type: application/json" \
  -d '{"include_resolved": false, "max_incidents": 500}'
```

---

## Deployment

### Railway (optional live mode)

This folder includes `railway.toml`, a Dockerfile, and `.env.railway.example`.

1. Create a Railway project/service from this repo.
2. Set the service root directory to `apps/api`.
3. Railway will build with Docker and run:
   `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`
4. In Railway service variables, add values from `.env.railway.example`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_ANON_KEY`
   - `CORS_ALLOW_ORIGINS`
   - `CORS_ALLOW_ORIGIN_REGEX`
5. Confirm health check: `GET /health` returns `200`.

After Railway is live, set dashboard env in Vercel:

```bash
VITE_API_URL=https://<your-railway-service-domain>
```

Then redeploy the dashboard.

### Koyeb (legacy option)

Koyeb instructions are deprecated in this repo. Use Railway/Fly/self-host only if you need live integrations.

---

## Project Structure

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
│       ├── machines.py     # Machine management
│       ├── aegis.py        # Aegis Sentinel integration
│       ├── graphs.py       # Knowledge graph endpoints
│       ├── vm.py           # Virtual Metrology
│       ├── scheduler.py    # Scheduler optimizer
│       └── simulation.py   # Simulation API
├── core/
│   ├── __init__.py
│   ├── anomaly_detector.py # ML anomaly detection
│   ├── sentinel_engine.py  # Aegis detection engine
│   ├── knowledge_graph_engine.py # Graph analytics
│   ├── monte_carlo.py      # Monte Carlo simulation
│   ├── toc_engine.py       # Theory of Constraints
│   ├── vm_engine.py        # Virtual Metrology
│   ├── rust_monte_carlo.py # Rust MC wrapper
│   └── rust_scheduler.py   # Rust scheduler wrapper
├── models/
│   ├── __init__.py
│   ├── schemas.py          # Pydantic schemas
│   └── aegis_schemas.py    # Aegis-specific schemas
└── services/
    ├── __init__.py
    └── supabase_service.py # Database service
```

---

## Core Engines

### Sentinel Engine (`app/core/sentinel_engine.py`)

Z-score + Rate-of-Change anomaly detection for Aegis agents.

```python
from app.core.sentinel_engine import sentinel_detector, safety_circuit

# Analyze telemetry
detection = sentinel_detector.analyze("CNC-001", "temperature", 95.0)
# Returns: {"severity": "high", "type": "thermal_runaway", "zone": "yellow", ...}

# Evaluate safety circuit
zone = safety_circuit.evaluate("high", "thermal_runaway")
# Returns: "yellow"
```

### Knowledge Graph Engine (`app/core/knowledge_graph_engine.py`)

NetworkX-based graph analytics for incident relationships.

```python
from app.core.knowledge_graph_engine import kg_engine

# Build graph from incidents
kg_engine.build_from_incidents(incidents)

# Export to Cytoscape format
cyto_json = kg_engine.to_cytoscape_json()

# Find related concepts
related = kg_engine.find_related_concepts("bearing_failure", depth=2)
```

---

## Related Documentation

- [Architecture.md](../../Architecture.md) - Full system architecture
- [AEGIS_INTEGRATION_GUIDE.md](../../AEGIS_INTEGRATION_GUIDE.md) - Aegis integration
- [AEGIS_SAND_TO_PACKAGE.md](../../AEGIS_SAND_TO_PACKAGE.md) - Sand-to-Package coverage
