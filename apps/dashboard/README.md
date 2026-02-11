# Smart Fab Dashboard

React + Vite + TypeScript frontend for the YieldOps Smart Fab manufacturing system.

## Features

- **Real-time Machine Monitoring**: Optional live machine status via Supabase Realtime
- **Four Dashboard Tabs**: Overview, Machines, Jobs, Sentinel
- **Machine Grid**: Visual representation of all fab machines with status indicators
- **Virtual Metrology**: Film thickness predictions with global cache (no flickering)
- **Production Jobs**: View pending jobs and hot lots with sorting and filtering
- **Aegis Sentinel**: Autonomous defense monitoring with Safety Circuit visualization
- **Knowledge Graphs**: Relationship visualization for incidents, jobs, and system
- **Statistics Dashboard**: Overview of machine status, efficiency, and job counts
- **Demo Mode**: Full functionality without backend configuration

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS 3.4
- Supabase Realtime (optional live mode)
- Recharts (data visualization)
- Tabler Icons React
- date-fns (date formatting)
- xlsx (Excel export)

## Dashboard Tabs

### Overview Tab
- KPI Cards (Machines, Efficiency, Wafers, Jobs, Alerts)
- ToC Dispatch Algorithm execution
- Dispatch Queue with hot lot prioritization
- Chaos Injection controls
- System Knowledge Graph visualization

### Machines Tab
- Machine Grid with filtering and sorting
- Real-time status indicators
- Virtual Metrology predictions
- Machine Detail Panel with controls
- Analytics & Excel Export

### Jobs Tab
- Job Statistics (Total, Pending, Queued, Running, Completed, Failed, Hot Lots)
- Sortable and filterable job list
- Hot Lot indicators
- Create Job modal
- Jobs Knowledge Graph visualization

### Sentinel Tab
- Aegis Sentinel monitoring
- Sand-to-Package Coverage Panel (Facility + Assembly)
- Agent status cards
- Safety Circuit (Green/Yellow/Red zones)
- Incident Feed with approve/resolve actions
- Knowledge Graph visualization

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

### Demo mode (default)

No environment variables are required. If `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` are unset, the app runs in full demo mode with mock data.

### Optional live mode

Create a `.env` file:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000
```

## Project Structure

```
src/
├── components/
│   ├── tabs/
│   │   ├── OverviewTab.tsx          # Overview with ToC dispatch
│   │   ├── MachinesTab.tsx          # Machine grid and details
│   │   ├── JobsTab.tsx              # Job management
│   │   └── SentinelTab.tsx          # Aegis Sentinel monitoring
│   ├── aegis/
│   │   ├── AgentCoveragePanel.tsx   # Sand-to-Package overview
│   │   ├── SentinelAgentCard.tsx    # Agent status card
│   │   ├── SafetyCircuitPanel.tsx   # 3-tier zone display
│   │   ├── IncidentFeed.tsx         # Real-time incidents
│   │   ├── KnowledgeGraphViz.tsx    # Graph visualization
│   │   ├── AgentTopology.tsx        # Network topology
│   │   └── MachineTopology.tsx      # Machine network view
│   ├── jobs/
│   │   └── JobsKnowledgeGraphViz.tsx # Jobs graph
│   ├── overview/
│   │   └── SystemKnowledgeGraphViz.tsx # System graph
│   ├── ui/
│   │   ├── KpiCard.tsx              # KPI display card
│   │   ├── StatusBadge.tsx          # Status indicator
│   │   ├── Modal.tsx                # Reusable modal
│   │   └── Toast.tsx                # Toast notifications
│   ├── MachineNode.tsx              # Machine card component
│   ├── AnalyticsModal.tsx           # Analytics and export
│   ├── SystemAnalyticsModal.tsx     # System-wide analytics
│   ├── ChaosPanel.tsx               # Chaos injection controls
│   ├── DecisionLog.tsx              # Dispatch history
│   ├── SPCControlChart.tsx          # SPC visualization
│   └── SPCViolationBadges.tsx       # SPC violation indicators
├── hooks/
│   ├── useRealtime.ts               # Supabase realtime subscription
│   ├── useVirtualMetrology.ts       # VM data with global cache
│   ├── useAegisRealtime.ts          # Aegis Sentinel data
│   ├── useAegisSentinel.ts          # Sentinel operations
│   ├── useAutonomousSimulation.ts   # Simulation control
│   └── usePolling.ts                # API polling
├── services/
│   ├── apiClient.ts                 # API client
│   └── supabaseClient.ts            # Supabase client
├── lib/
│   └── spcEngine.ts                 # SPC calculations
├── types/
│   └── index.ts                     # TypeScript types
├── App.tsx                          # Main app component
└── main.tsx                         # Entry point
```

## Custom Hooks

### useAegisRealtime

Main hook for Aegis Sentinel data with Supabase Realtime integration.

```typescript
const {
  summary,           // SentinelSummary - incidents, agents, safety circuit
  incidents,         // IncidentResponse[] - all incidents
  agents,            // AgentStatus[] - registered agents
  facilitySummary,   // FacilitySummary - FFU status
  assemblySummary,   // AssemblySummary - bonder status
  loading,           // boolean
  isConnected,       // boolean - realtime connection
  isDemoMode,        // boolean
  approveIncident,   // (id: string) => Promise<void>
  resolveIncident,   // (id: string) => Promise<void>
} = useAegisRealtime();
```

### useVirtualMetrology

VM data with global shared cache to prevent flickering.

```typescript
const { status, history, isLoading, error, refresh } = useVirtualMetrology(
  machineId,
  { pollingInterval: 30000, enabled: true }
);
```

### useRealtime

Core Supabase Realtime subscription for machines and jobs.

```typescript
const {
  machines,
  jobs,
  loading,
  isDemoMode,
  updateMachine,
  updateJob,
  addJob,
} = useRealtime();
```

## Demo Mode

The dashboard includes a **Demo Mode** that provides full functionality without requiring backend configuration:

**Features:**
- All four tabs functional with realistic mock data
- 48 machines, 25 jobs with real customer names
- Working ToC Dispatch algorithm
- Aegis Sentinel with sample incidents
- Knowledge Graphs with mock data
- Virtual Metrology with persistent cache
- Immediate UI updates with toast notifications

Demo mode is automatically enabled when live-mode environment variables are not configured.

## Deployment

This app is configured for deployment on Vercel.

### Vercel Configuration

1. Connect GitHub repo to Vercel
2. Set framework preset to "Vite"
3. Set root directory to `apps/dashboard`
4. For demo mode, no env vars are required.
5. For live mode, add:
   - `VITE_API_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

See `vercel.json` for additional configuration.

## Related Documentation

- [Architecture.md](../../Architecture.md) - Full system architecture
- [AEGIS_INTEGRATION_GUIDE.md](../../AEGIS_INTEGRATION_GUIDE.md) - Aegis integration
- [AEGIS_SAND_TO_PACKAGE.md](../../AEGIS_SAND_TO_PACKAGE.md) - Sand-to-Package coverage
