# Real Data Verification - YieldOps

This document confirms that **YieldOps uses REAL data from Supabase exclusively** when connected. Mock data is ONLY used as a fallback when Supabase is NOT configured.

## Data Source Guarantees

### When Supabase IS Connected (hasSupabase = true)

| Data Type | Source | Mock Data Used? |
|-----------|--------|-----------------|
| **Machines** | Supabase Realtime (`useRealtimeMachines`) | ❌ NO |
| **Jobs** | Supabase Realtime Stream (`useJobStream`) | ❌ NO |
| **Sensor Data** | Supabase Realtime (`useLatestSensorData`) | ❌ NO |
| **Job Generations** | Backend API → Supabase DB | ❌ NO |
| **All UI Display** | Real-time subscriptions | ❌ NO |

### When Supabase NOT Connected (Demo Mode)

| Data Type | Source | Real Data Used? |
|-----------|--------|-----------------|
| **Machines** | MOCK_MACHINES constant | ❌ NO (fallback only) |
| **Jobs** | MOCK_JOBS constant | ❌ NO (fallback only) |
| **Simulation** | Frontend autonomous simulation | ❌ NO (fallback only) |

## Code Verification Points

### 1. App.tsx Data Source Selection (Lines ~219-280)

```typescript
// ONLY uses realtime data when Supabase is connected
useEffect(() => {
  if (hasSupabase) {
    setDisplayMachines(realtimeMachines);  // ← REAL DATA
  } else {
    setDisplayMachines(MOCK_MACHINES);      // ← mock fallback only
  }
}, [hasSupabase, realtimeMachines]);

// Jobs use real-time stream when Supabase is connected
useEffect(() => {
  if (hasSupabase) {
    if (streamJobs.length > 0) {
      setDisplayJobs(streamJobs);           // ← REAL DATA from stream
    } else if (realtimeJobs.length > 0) {
      setDisplayJobs(realtimeJobs);         // ← REAL DATA fallback
    }
  } else {
    setDisplayJobs(MOCK_JOBS);              // ← mock fallback only
  }
}, [hasSupabase, streamJobs, realtimeJobs]);
```

### 2. useAutonomousSimulation Hook

**CRITICAL:** The simulation hook checks `isUsingMockData` before ANY operation:

```typescript
const simulateJobProgression = useCallback(() => {
  if (!isUsingMockData) return;  // ← STOPS if using real data
  // ... simulation logic only runs in demo mode
}, [jobs, machines, updateJob, updateMachine, isUsingMockData]);

const generateNewJobs = useCallback(() => {
  if (!isUsingMockData) return;  // ← STOPS if using real data
  // ... job generation only runs in demo mode
}, [jobs, addJob, isUsingMockData]);
```

### 3. Backend Job Generator (Real Data Only)

When Supabase is connected, the **backend** `DynamicJobGenerator` creates jobs:

```python
# Creates REAL jobs in Supabase database
async def generate_job(self, triggered_by: str = "scheduler"):
    job_data = {
        "job_name": self._generate_job_name(is_hot_lot),
        "wafer_count": wafer_count,
        "priority_level": priority,
        "status": "PENDING",
        "recipe_type": recipe,
        "is_hot_lot": is_hot_lot,
        "customer_tag": customer,
        # ...
    }
    
    # Insert into REAL Supabase database
    response = self.client.table("production_jobs").insert(job_data).execute()
    
    # Log generation
    self.client.table("job_generation_log").insert({
        "job_id": job_id,
        "generation_reason": "AUTONOMOUS",
        "triggered_by": triggered_by,
    }).execute()
```

### 4. Real-time Job Stream Hook

The `useJobStream` hook:
- Subscribes to Supabase Realtime for live updates
- Fetches initial data from Supabase DB
- NEVER uses mock data

```typescript
const fetchJobs = useCallback(async () => {
  const { data, error } = await supabase
    .from('production_jobs')
    .select('*')
    .order('created_at', { ascending: false });
  
  setJobs(data.map(mapDatabaseJob));  // ← REAL DATA from DB
}, []);
```

## UI Indicators

### When Supabase is Connected:
- ✅ Shows "Live Data" badge (green pulse)
- ✅ Shows real-time job arrival notifications
- ✅ Shows "📡 Live Jobs" in KPI cards
- ✅ Hides "Demo Mode" badge
- ✅ Hides simulation controls (backend handles it)

### When in Demo Mode:
- ⚠️ Shows "Demo Mode" badge (amber)
- ⚠️ Shows simulation controls
- ⚠️ Data is local/mock only

## Configuration Requirements

To use REAL data, you MUST set these environment variables:

```bash
# apps/dashboard/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=https://your-api.com  # optional, for backend features
```

## Verification Test

1. Open browser console
2. Check for messages:
   - `"Live Data"` badge visible = using real data
   - `"[YieldOps] Detected mock machine data while Supabase is connected"` = error detected and corrected

3. Network tab should show:
   - WebSocket connections to `wss://*.supabase.co`
   - API calls to your backend (if configured)
   - NO mock data imports after initial load

## Summary

| Question | Answer |
|----------|--------|
| Does it use real Supabase data when connected? | **YES** - exclusively |
| Can mock data leak into real mode? | **NO** - multiple guards prevent this |
| Where are autonomous jobs created in real mode? | **Backend** → Supabase DB |
| Where are autonomous jobs created in demo mode? | **Frontend** simulation only |
| Is real-time streaming active? | **YES** - via Supabase Realtime |
