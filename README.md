# YieldOps - Smart Fab

Intelligent Manufacturing & IIoT Portfolio Project

**Live Demo:** [https://yield-ops-dashboard.vercel.app/](https://yield-ops-dashboard.vercel.app/) *(Frontend)*  
**API Endpoint:** <https://beneficial-mathilde-yieldops-883cf8bf.koyeb.app/> *(Backend)*

---

## Overview

**Smart Fab** is a full-stack Industrial IoT (IIoT) portfolio project demonstrating intelligent semiconductor manufacturing capabilities. The system simulates a fabrication plant with real-time machine monitoring, automated job dispatching using Theory of Constraints (ToC) algorithms, predictive maintenance through machine learning, and Virtual Metrology for advanced process control.

### Key Capabilities

- **Real-time Monitoring**: Live machine status via WebSockets/Supabase Realtime
- **Intelligent Dispatching**: Automated job routing based on efficiency and priority (Theory of Constraints)
- **Predictive Maintenance**: Anomaly detection using Isolation Forest with SPC control charts
- **Virtual Metrology**: Predict film thickness and enable Run-to-Run (R2R) control
- **Capacity Planning**: Monte Carlo simulation for production forecasting
- **Chaos Engineering**: Controlled failure injection for resilience testing
- **Process Capability (CPK)**: Statistical process control with CPK calculation and visualization
- **Job Lifecycle Management**: Full job status control (Pending → Queued → Running → Completed/Failed)
- **Autonomous Job Generation**: Database-backed dynamic job creation with weighted customers, priorities, and recipes
- **Full Job Lifecycle Automation**: PENDING → QUEUED → Machine Assignment → RUNNING → COMPLETED/FAILED (all autonomous)
- **Simulation Speed Control**: 1x/10x/100x speed for accelerated demo/testing
- **Mobile-Responsive Design**: Full dashboard functionality on mobile devices
- **Demo Mode**: Full functionality without backend configuration

---

## Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend - Vercel"]
        React["React 18 + Vite + TypeScript"]
        Tailwind["Tailwind CSS"]
        Charts["Recharts"]
        
        subgraph Tabs["Dashboard Tabs"]
            Overview["Overview Tab"]
            Machines["Machines Tab"]
            Jobs["Jobs Tab"]
        end
        
        React --> Tailwind
        React --> Charts
        React --> Tabs
    end

    subgraph Backend["Backend - Koyeb"]
        FastAPI["FastAPI Controller"]
        ToC["ToC Dispatch Engine"]
        ML["ML Models"]
        VM["Virtual Metrology"]
        Chaos["Chaos API"]
        
        FastAPI --> ToC
        FastAPI --> ML
        FastAPI --> VM
        FastAPI --> Chaos
    end

    subgraph Database["Database - Supabase"]
        PostgreSQL["PostgreSQL + Realtime"]
        Machines[(Machines)]
        SensorData[(Sensor Data)]
        Jobs[(Jobs)]
        
        PostgreSQL --> Machines
        PostgreSQL --> SensorData
        PostgreSQL --> Jobs
    end

    Frontend <-->|HTTP REST| Backend
    Backend <-->|PostgreSQL| Database
    Frontend <-.->|Realtime| Database
```

---

## Technology Stack

| Layer | Technology | Purpose | Hosting |
|-------|------------|---------|---------|
| **Frontend** | React 18 + Vite + TypeScript | UI Framework | Vercel |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS | - |
| **Charts** | Recharts | Data Visualization | - |
| **Icons** | Lucide React | Icon Library | - |
| **Backend** | FastAPI (Python 3.11) | API & ML Services | Koyeb |
| **Database** | PostgreSQL 15 | Primary Data Store | Supabase |
| **Realtime** | Supabase Realtime | WebSocket Events | Supabase |
| **ML** | Scikit-Learn | Anomaly Detection & VM | - |

---

## Repository Structure

```
YieldOps/
├── apps/
│   ├── dashboard/          # React Frontend (Vercel)
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   │   ├── tabs/         # Overview, Machines, Jobs tabs
│   │   │   │   ├── ui/           # Reusable UI components
│   │   │   │   └── *.tsx         # Component files
│   │   │   ├── hooks/         # Custom hooks (useRealtime, useVirtualMetrology)
│   │   │   ├── services/      # API & Supabase clients
│   │   │   ├── lib/           # Utility libraries
│   │   │   └── types/         # TypeScript types
│   │   └── .env               # Environment variables
│   │
│   └── api/                # FastAPI Backend (Koyeb)
│       ├── app/
│       │   ├── api/v1/        # API endpoints
│       │   ├── core/          # ML & algorithms
│       │   ├── models/        # Pydantic schemas
│       │   └── services/      # Database service
│       └── requirements.txt
│
├── packages/
│   └── types/              # Shared TypeScript types
├── database/               # Schema & seed files
│   ├── schema.sql          # Core database schema
│   ├── seed.sql            # Seed data (48 machines, 25 jobs)
│   ├── reset_and_seed.sql  # Full reset + seed for Supabase
│   └── migrations/
│       ├── 002_virtual_metrology.sql
│       └── 003_autonomous_jobs.sql  # Autonomous job generation tables
├── README.md               # This file
└── Architecture.md         # Detailed architecture docs
```

### Database Seed Data

| Entity | Count | Description |
|--------|-------|-------------|
| **Machines** | 48 | LITHO-01 to DEP-12 across 8 zones |
| **Production Jobs** | 25 | Apple, NVIDIA, AMD, Intel, etc. |
| **Sensor Readings** | 4,800+ | 100+ per machine for VM training |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account (optional for demo mode)

### Setup

1. **Clone the repository**

   ```bash
   git clone git@github.com:AngelP17/YieldOps.git
   cd YieldOps
   ```

2. **Install dependencies**

   ```bash
   # Root
   npm install
   
   # Dashboard
   cd apps/dashboard && npm install
   
   # API
   cd apps/api && pip install -r requirements.txt
   ```

3. **Environment Variables** (Optional for demo mode)

   Create `.env` files:

   **apps/api/.env:**

   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_key
   SUPABASE_ANON_KEY=your_anon_key
   DEBUG=true
   ```

   **apps/dashboard/.env:**

   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_API_URL=http://localhost:8000
   ```

4. **Run Development**

   ```bash
   # Dashboard
   npm run dev:dashboard
   
   # API (optional for demo mode)
   npm run dev:api
   ```

---

## Demo Mode

YieldOps includes a **Demo Mode** that provides full UI functionality without requiring any backend configuration:

```mermaid
flowchart TD
    A[Start App] --> B{Environment Configured?}
    B -->|Yes| C[Connect to Backend]
    B -->|No| D[Enable Demo Mode]
    D --> E[Load Mock Data]
    E --> F[Display Demo Badge]
    F --> G[All Actions Work with Toast Notifications]
```

**Demo Mode Features:**

- ✅ All three tabs functional (Overview, Machines, Jobs)
- ✅ Realistic mock data (48 machines, 25 jobs with real customers)
- ✅ **Working ToC Dispatch** - Actually assigns jobs to machines using Goldratt's algorithm
- ✅ **Immediate UI Updates** - All actions update state without page refresh
- ✅ **Simulation Speed Control** - 1x/10x/100x speed toggle
- ✅ Machine detail panel with status controls, chaos injection, recovery
- ✅ Job creation and full lifecycle management (Queue, Start, Complete, Fail, Cancel, Retry)
- ✅ Sorting on all tabs (priority, deadline, status, efficiency, type)
- ✅ Analytics modal with SPC charts, CPK display, and Excel export
- ✅ Virtual Metrology with fallback mock predictions
- ✅ System Analytics with realistic data fallback
- ✅ Toast notifications for all actions
- ✅ Mobile-responsive design with bottom navigation
- ❌ No persistent data storage
- ❌ No real-time sync across tabs/users

---

## Live Mode (Supabase)

When connected to Supabase, the system operates in **Live Mode** with real-time data sync:

**Live Mode Features:**

- ✅ Real-time data sync via Supabase Realtime
- ✅ Persistent data storage in PostgreSQL
- ✅ Autonomous simulation (jobs progress automatically) with speed control
- ✅ **Autonomous job generation** via `DynamicJobGenerator` backend service
- ✅ **Full job lifecycle automation**: PENDING → QUEUED → assigned → RUNNING → COMPLETED/FAILED
- ✅ Autonomous job failures (2% random failure rate for realism)
- ✅ Live VM predictions using sensor data
- ✅ Multi-user support (all users see same data)
- ✅ Changes propagate instantly without page refresh
- ✅ Full mobile-responsive interface

### Setting Up Live Mode

1. **Create Supabase Project** at [supabase.com](https://supabase.com)
2. **Run Database Migration** in Supabase SQL Editor:
   - Copy contents of `database/reset_and_seed.sql`
   - Paste into SQL Editor and run
3. **Configure Environment Variables** in Vercel:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

---

## Dashboard Tabs

### Overview Tab

- KPI Cards (Machines, Efficiency, Wafers, Jobs, Alerts)
- **ToC Dispatch** - Run Theory of Constraints dispatch algorithm
- **Simulation Speed Control** - 1x/10x/100x toggle (when simulation enabled)
- Dispatch Queue with prioritized jobs (hot lots first)
- Recent Dispatch Decisions with timestamps
- Production Queue preview with assigned machines
- Chaos Injection controls (machine down, sensor spike, efficiency drop)
- Machine Status Summary with visual progress bar
- Troubled Machines list with recover actions
- Mobile-optimized layout with responsive grids

### Machines Tab

- Machine Grid with filterable/sortable cards (by name, status, efficiency, type)
- Real-time status indicators with VM predictions
- **Sorting** - Name, Status, Efficiency, Type
- Mobile-optimized grid (1-3 columns based on screen size)
- Machine Detail Panel:
  - Status controls (IDLE, RUNNING, MAINTENANCE, DOWN)
  - Metrics (Efficiency, Wafers, Temperature, Vibration)
  - **Analytics & Export** - View detailed analytics and export to Excel
  - **SPC Control Charts** with CPK calculation and USL/LSL reference lines
  - Recover action for troubled machines
  - Chaos injection (machine down, sensor spike, efficiency drop)

### Jobs Tab

- Job Statistics (Total, Pending, Queued, Running, Completed, Failed, Hot Lots)
- **Enhanced Sorting** - Priority (hot lots first), Deadline, Created
- Filterable Job List by status and search
- Hot Lot filter toggle
- Create Job Modal with full form
- **Job Lifecycle Actions** - Queue, Start, Complete, Fail, Cancel, Retry per job
- **Autonomous Job Failures** - 2% random failure rate during simulation
- Hot Lot indicators and Priority badges
- Assigned machine display
- Mobile-optimized action menus (ellipsis dropdown)

---

## Mobile Responsiveness

YieldOps is fully responsive and optimized for mobile devices:

| Feature | Desktop | Mobile |
|---------|---------|--------|
| **Navigation** | Top tab bar (Overview, Machines, Jobs) | Fixed bottom tab bar |
| **Header** | Full controls with labels | Compact icons with hidden labels |
| **Simulation Controls** | Full buttons with speed pills | Compact icons + small speed pills |
| **KPI Cards** | 6-column grid | 2-column grid |
| **Job List** | Full details with action buttons | Condensed with ellipsis menu |
| **Modals** | Centered dialog | Bottom sheet style |
| **Toast Notifications** | Bottom-right | Above bottom nav |

**Mobile-First Design Patterns:**
- `hidden sm:block` / `hidden sm:inline` for label text
- `px-4 sm:px-6` for responsive padding
- `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` for responsive grids
- Fixed bottom nav with `pb-24` content clearance
- Touch-friendly minimum 48px tap targets

---

## Key Features

### Simulation Speed Control

Adjust simulation speed for testing or demonstration:

```
[▶ Sim] [1x] [10x] [100x]
```

- **1x**: Normal speed (5s job progression interval)
- **10x**: 10x faster simulation
- **100x**: Near real-time progression for demos

All intervals scale proportionally: job progression, machine events, new job generation, sensor updates.

### CPK Process Capability

SPC charts display CPK (Process Capability Index) for quality monitoring:

| CPK Value | Rating | Color |
|-----------|--------|-------|
| ≥ 1.67 | Excellent | 🟢 Green |
| ≥ 1.33 | Good | 🔵 Blue |
| ≥ 1.00 | Marginal | 🟡 Amber |
| < 1.00 | Poor | 🔴 Red |

**Calculation:** `CPK = min((USL - mean) / 3σ, (mean - LSL) / 3σ)`

USL/LSL reference lines shown in purple on SPC charts.

### Autonomous Job Generation

The system generates new production jobs autonomously through two mechanisms:

**Frontend (Demo Mode):** `useAutonomousSimulation` generates PENDING jobs every 15s (speed-adjusted), then autonomously queues, assigns machines, and runs them through the full lifecycle.

**Backend (Live Mode):** `DynamicJobGenerator` service monitors queue depth and generates jobs via Supabase when active jobs fall below minimum threshold.

**Database Migration** (`003_autonomous_jobs.sql`):
- `job_generation_config` - Configurable generation parameters (interval, limits, probabilities)
- `job_generation_log` - Audit trail for all generated jobs
- `generate_autonomous_job()` - PL/pgSQL function with weighted customer/priority selection
- `batch_generate_jobs_if_needed()` - Batch generation when queue drops below minimum

### Job Lifecycle Management

Full autonomous + manual control over job states:

```
PENDING → QUEUED → RUNNING → COMPLETED
   ↓          ↓          ↓
CANCELLED  CANCELLED   FAILED
   ↑          ↑          ↑
 (Retry)   (Retry)    (Retry)
```

**Autonomous Flow (Simulation):**
1. New jobs generated as PENDING (auto or manual)
2. PENDING → QUEUED (hot lots immediately, others 30% chance/cycle)
3. QUEUED → Machine assigned (ToC dispatch: hot lots first, then priority)
4. QUEUED with machine → RUNNING (when machine is IDLE)
5. RUNNING → COMPLETED (5%) or FAILED (2%) per cycle

**Manual Actions by Current State:**

| Current | Available Actions |
|---------|------------------|
| PENDING | Queue, Cancel |
| QUEUED | Start, Cancel |
| RUNNING | Complete, Fail, Cancel |
| FAILED | Retry |
| CANCELLED | Retry |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/machines` | GET | List machines |
| `/api/v1/jobs` | GET/POST | List/Create jobs |
| `/api/v1/jobs/{id}` | PATCH | Update job status |
| `/api/v1/jobs/{id}/cancel` | POST | Cancel job |
| `/api/v1/dispatch/run` | POST | Execute ToC dispatch |
| `/api/v1/dispatch/queue` | GET | View dispatch queue |
| `/api/v1/job-generator/config` | GET/POST | Get/Update generator config |
| `/api/v1/job-generator/status` | GET | Get generator status/stats |
| `/api/v1/job-generator/start` | POST | Start autonomous generator |
| `/api/v1/job-generator/stop` | POST | Stop autonomous generator |
| `/api/v1/job-generator/generate` | POST | Manually generate single job |
| `/api/v1/job-generator/counts` | GET | Get job counts by status |
| `/api/v1/analytics/monte-carlo` | POST | Run simulation |
| `/api/v1/analytics/anomalies` | GET | Get anomaly stats |
| `/api/v1/chaos/inject` | POST | Inject failure |
| `/api/v1/chaos/recover/{id}` | POST | Recover machine |
| `/api/v1/vm/status/{id}` | GET | Get VM status |
| `/api/v1/vm/predict` | POST | Request VM prediction |

See [Architecture.md](Architecture.md) for complete documentation.

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

# Get VM status
curl http://localhost:8000/api/v1/vm/status/{machine_id}
```

---

## Documentation

- **[Architecture.md](Architecture.md)** - Detailed architecture, database schema, API specs, Mermaid diagrams
- **[apps/api/README.md](apps/api/README.md)** - API-specific documentation
- **[apps/dashboard/README.md](apps/dashboard/README.md)** - Frontend documentation

---

## License

MIT License
