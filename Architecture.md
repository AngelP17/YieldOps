# YieldOps - Smart Fab Architecture

Intelligent Manufacturing & IIoT Portfolio Project

**Live Demo:** https://beneficial-mathilde-yieldops-883cf8bf.koyeb.app/

---

## Executive Summary

**Smart Fab** is a full-stack Industrial IoT (IIoT) portfolio project demonstrating intelligent semiconductor manufacturing capabilities. The system simulates a fabrication plant with real-time machine monitoring, automated job dispatching using Theory of Constraints (ToC) algorithms, and predictive maintenance through machine learning.

### Key Capabilities

- **Real-time Monitoring**: Live machine status via WebSockets
- **Intelligent Dispatching**: Automated job routing based on efficiency and priority
- **Predictive Maintenance**: Anomaly detection using Isolation Forest
- **Capacity Planning**: Monte Carlo simulation for production forecasting
- **Chaos Engineering**: Controlled failure injection for resilience testing

---

## System Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend - Vercel"]
        React["React 18 + Vite + TypeScript"]
        Tailwind["Tailwind CSS"]
        Charts["Recharts"]
        React --> Tailwind
        React --> Charts
    end

    subgraph Backend["Backend - Koyeb"]
        FastAPI["FastAPI Controller"]
        ToC["Theory of Constraints Engine"]
        ML["ML Models"]
        Chaos["Chaos Engineering API"]
        FastAPI --> ToC
        FastAPI --> ML
        FastAPI --> Chaos
    end

    subgraph Database["Database - Supabase"]
        PostgreSQL["PostgreSQL 15"]
        Realtime["Realtime WebSockets"]
        Machines[(Machines)]
        SensorData[(Sensor Readings)]
        Jobs[(Production Jobs)]
        Decisions[(Dispatch Decisions)]
        PostgreSQL --> Machines
        PostgreSQL --> SensorData
        PostgreSQL --> Jobs
        PostgreSQL --> Decisions
        PostgreSQL --> Realtime
    end

    Frontend <-->|HTTP/WebSocket| Backend
    Backend <-->|REST API| Database
    Frontend <-.->|Supabase Realtime| Database
```

---

## Technology Stack

| Layer | Technology | Purpose | Hosting |
|-------|------------|---------|---------|
| **Frontend** | React 18 + Vite + TypeScript | UI Framework | Vercel |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS | - |
| **Charts** | Recharts | Data Visualization | - |
| **Backend** | FastAPI (Python 3.11) | API & ML Services | Koyeb |
| **Database** | PostgreSQL 15 | Primary Data Store | Supabase |
| **Realtime** | Supabase Realtime | WebSocket Events | Supabase |
| **ML** | Scikit-Learn | Anomaly Detection | - |

### Why This Stack?

| Component | Winner | Why It Wins |
|-----------|--------|-------------|
| **Database** | **Supabase** | Free Realtime (WebSockets) for live dashboard updates without polling |
| **Backend** | **Koyeb** | Free tier with no cold starts - stays running for responsive demos |
| **Frontend** | **Vercel** | Best React support with automatic CI/CD and client-side routing |

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    machines {
        uuid machine_id PK
        varchar name
        varchar type
        varchar status
        decimal efficiency_rating
        varchar location_zone
        timestamp created_at
    }
    
    sensor_readings {
        uuid reading_id PK
        uuid machine_id FK
        decimal temperature
        decimal vibration
        decimal pressure
        boolean is_anomaly
        timestamp recorded_at
    }
    
    production_jobs {
        uuid job_id PK
        varchar job_name
        int wafer_count
        int priority_level
        varchar status
        uuid assigned_machine_id FK
        boolean is_hot_lot
        timestamp deadline
        timestamp created_at
    }
    
    dispatch_decisions {
        uuid decision_id PK
        uuid job_id FK
        uuid machine_id FK
        text decision_reason
        timestamp dispatched_at
    }
    
    machines ||--o{ sensor_readings : "generates"
    machines ||--o{ dispatch_decisions : "receives"
    production_jobs ||--o{ dispatch_decisions : "dispatched"
    machines ||--o{ production_jobs : "processes"
```

### Core Tables

#### Machines
```sql
CREATE TABLE machines (
    machine_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- lithography, etching, deposition, inspection, cleaning
    status VARCHAR(20) NOT NULL DEFAULT 'IDLE', -- IDLE, RUNNING, DOWN, MAINTENANCE
    efficiency_rating DECIMAL(4,2) NOT NULL CHECK (efficiency_rating >= 0.00 AND efficiency_rating <= 1.00),
    location_zone VARCHAR(20) NOT NULL,
    current_wafer_count INTEGER DEFAULT 0,
    total_wafers_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Sensor Readings
```sql
CREATE TABLE sensor_readings (
    reading_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    temperature DECIMAL(6,2) NOT NULL,
    vibration DECIMAL(6,3) NOT NULL,
    pressure DECIMAL(8,2),
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_score DECIMAL(5,4),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Production Jobs
```sql
CREATE TABLE production_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    wafer_count INTEGER NOT NULL CHECK (wafer_count > 0),
    priority_level INTEGER NOT NULL CHECK (priority_level BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    recipe_type VARCHAR(50) NOT NULL,
    assigned_machine_id UUID REFERENCES machines(machine_id),
    is_hot_lot BOOLEAN DEFAULT FALSE,
    deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Dispatch Decisions
```sql
CREATE TABLE dispatch_decisions (
    decision_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES production_jobs(job_id),
    machine_id UUID NOT NULL REFERENCES machines(machine_id),
    decision_reason TEXT NOT NULL,
    algorithm_version VARCHAR(20) DEFAULT '1.0.0',
    efficiency_at_dispatch DECIMAL(4,2),
    queue_depth_at_dispatch INTEGER,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

See `database/schema.sql` for complete schema with indexes, triggers, and RLS policies.

---

## Repository Structure

```
YieldOps/
├── apps/
│   ├── dashboard/          # React Frontend (Vercel)
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── services/      # API clients
│   │   │   └── types/         # TypeScript types
│   │   ├── .env               # Environment variables (not in git)
│   │   ├── .env.example       # Example env file
│   │   └── vercel.json        # Vercel config
│   │
│   └── api/                # FastAPI Backend (Koyeb)
│       ├── app/
│       │   ├── api/v1/        # API endpoints
│       │   ├── core/          # ML & algorithms
│       │   ├── models/        # Pydantic schemas
│       │   └── services/      # Database service
│       ├── .env               # Environment variables (not in git)
│       ├── .env.example       # Example env file
│       ├── requirements.txt
│       └── koyeb.yaml         # Koyeb config
│
├── packages/
│   └── types/              # Shared TypeScript types
│
├── ml/                     # ML notebooks & scripts
├── database/               # Schema & seed files
│   ├── schema.sql
│   └── seed.sql
│
├── README.md               # Project overview
└── Architecture.md         # This file
```

---

## Core Components

### 1. Theory of Constraints (ToC) Dispatch Engine

```mermaid
flowchart TD
    A[Pending Jobs] --> B{Is Hot Lot?}
    B -->|Yes| C[Priority 1]
    B -->|No| D[Sort by Priority Level]
    D --> E[Priority 2-5]
    C --> F[FIFO within Priority]
    E --> F
    F --> G[Select Best Machine]
    G --> H{Machine Available?}
    H -->|Yes| I[Assign Job]
    H -->|No| J[Queue Job]
    I --> K[Log Decision]
```

**Algorithm Rules:**
1. Hot Lots (is_hot_lot=True) always first
2. Priority level (1=highest, 5=lowest)
3. FIFO within same priority
4. Select machine with highest efficiency rating

### 2. Anomaly Detection (ML)

- **Algorithm**: Isolation Forest
- **Features**: Temperature, Vibration, Pressure
- **Output**: Anomaly score (0-1) + Confidence level
- **Training**: Auto-initializes with synthetic data

### 3. Monte Carlo Simulation

- **Purpose**: Capacity planning & throughput forecasting
- **Iterations**: 10,000+ simulations
- **Output**: P5, P50, P95, P99 confidence intervals
- **Use Case**: "Can we meet 1000 wafers/day target?"

### 4. Chaos Engineering API

**Scenarios:**
- `machine_down`: Force machine failure
- `sensor_spike`: Inject anomalous readings
- `efficiency_drop`: Reduce machine efficiency

**Purpose**: Test system resilience under failures

---

## API Reference

### Base URL
```
Production: https://beneficial-mathilde-yieldops-883cf8bf.koyeb.app
Local: http://localhost:8000
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/machines` | GET | List all machines |
| `/api/v1/machines/{id}` | GET | Get machine details |
| `/api/v1/machines/{id}/stats` | GET | Get machine statistics |
| `/api/v1/jobs` | GET | List all jobs |
| `/api/v1/jobs/queue` | GET | Get job queue |
| `/api/v1/dispatch/run` | POST | Execute ToC dispatch |
| `/api/v1/dispatch/queue` | GET | View dispatch queue |
| `/api/v1/analytics/monte-carlo` | POST | Run simulation |
| `/api/v1/analytics/bottlenecks` | GET | Identify bottlenecks |
| `/api/v1/chaos/inject` | POST | Inject failure |
| `/api/v1/chaos/recover/{id}` | POST | Recover machine |
| `/api/v1/chaos/scenarios` | GET | List chaos scenarios |

See `apps/api/README.md` for detailed API documentation.

---

## Environment Variables

### apps/api/.env
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
DEBUG=true
AUTO_INIT_MODEL=true
```

### apps/dashboard/.env
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:8000
```

---

## Deployment

### Backend (Koyeb)

```bash
koyeb app create yieldops-api \
  --git github.com:AngelP17/YieldOps.git \
  --git-branch main \
  --git-build-command "pip install -r requirements.txt" \
  --git-run-command "uvicorn app.main:app --host 0.0.0.0 --port 8000" \
  --git-workdir apps/api \
  --ports 8000:http \
  --instance-type nano
```

### Frontend (Vercel)

1. Connect GitHub repo to Vercel
2. Set framework preset to "Vite"
3. Set root directory to `apps/dashboard`
4. Add environment variables

---

## Quick Start

```bash
# Clone repository
git clone git@github.com:AngelP17/YieldOps.git
cd YieldOps

# Install dependencies
npm install
cd apps/api && pip install -r requirements.txt

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
# Edit .env files with your credentials

# Run development servers
npm run dev:dashboard  # Terminal 1
npm run dev:api        # Terminal 2
```

---

## Testing

```bash
# Health check
curl http://localhost:8000/health

# Inject chaos
curl -X POST http://localhost:8000/api/v1/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{"failure_type": "machine_down"}'

# Run Monte Carlo simulation
curl -X POST http://localhost:8000/api/v1/analytics/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{"time_horizon_days": 30, "n_simulations": 1000}'
```

---

## License

MIT License
