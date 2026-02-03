# YieldOps - Smart Fab

Intelligent Manufacturing & IIoT Portfolio Project

## Architecture

**Smart Fab** is a full-stack Industrial IoT (IIoT) portfolio project demonstrating intelligent semiconductor manufacturing capabilities.

### Key Capabilities
- **Real-time Monitoring**: Live machine status via WebSockets
- **Intelligent Dispatching**: Automated job routing based on efficiency and priority
- **Predictive Maintenance**: Anomaly detection using Isolation Forest
- **Capacity Planning**: Monte Carlo simulation for production forecasting
- **Chaos Engineering**: Controlled failure injection for resilience testing

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + Vite + TypeScript | UI Framework |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS |
| **Charts** | Recharts | Data Visualization |
| **Backend** | FastAPI (Python 3.11) | API & ML Services |
| **Database** | PostgreSQL 15 | Primary Data Store |
| **Realtime** | Supabase Realtime | WebSocket Events |
| **ML** | Scikit-Learn | Anomaly Detection |

## Repository Structure

```
YieldOps/
├── apps/
│   ├── dashboard/          # React Frontend (Vercel)
│   └── api/                # FastAPI Backend (Koyeb)
├── packages/
│   └── types/              # Shared TypeScript types
├── ml/                     # ML & Simulation
└── database/               # Schema & Seed files
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account

### Setup

1. **Install dependencies**
   ```bash
   # Root
   npm install
   
   # Dashboard
   cd apps/dashboard && npm install
   
   # API
   cd apps/api && pip install -r requirements.txt
   ```

2. **Environment Variables**
   
   Create `.env` files in respective apps (see Architecture.md for details)

3. **Run Development**
   ```bash
   # Dashboard
   npm run dev:dashboard
   
   # API
   npm run dev:api
   ```

## License

MIT License
