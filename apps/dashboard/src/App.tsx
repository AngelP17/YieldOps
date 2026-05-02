import { useState, useMemo, createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { Machine, ProductionJob } from './types';
import { useRealtimeMachines, useLatestSensorData, useRealtimeJobs } from './hooks/useRealtime';
import { useAutonomousSimulation } from './hooks/useAutonomousSimulation';
import { isApiConfigured, isSupabaseConfigured } from './services/apiClient';
import { OverviewTab } from './components/tabs/OverviewTab';
import { MachinesTab } from './components/tabs/MachinesTab';
import { JobsTab } from './components/tabs/JobsTab';
import { SentinelTab } from './components/tabs/SentinelTab';
import { NotebooksTab } from './components/tabs/NotebooksTab';
import { MOCK_MACHINES } from './fixtures/machines';
import { MOCK_JOBS } from './fixtures/jobs';
import {
  IconBuildingFactory2,
  IconChartBar,
  IconCpu,
  IconWifi,
  IconWifiOff,
  IconRefresh,
  IconAlertTriangle,
  IconPlayerPlay,
  IconPlayerPause,
  IconShield,
  IconExternalLink,
  IconGauge,
  IconRoute,
  IconBrain,
  IconFlask,
  IconChartHistogram
} from '@tabler/icons-react';

const DEFAULT_TRANSVEC_BASE_URL = 'https://transvec.vercel.app';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

// Context for app configuration and state management
interface AppConfigContextType {
  isUsingMockData: boolean;
  isSupabaseConnected: boolean;
  isApiConfigured: boolean;
  machines: Machine[];
  jobs: ProductionJob[];
  updateMachine: (machineId: string, updates: Partial<Machine>) => void;
  addJob: (job: ProductionJob) => void;
  updateJob: (jobId: string, updates: Partial<ProductionJob>) => void;
  refreshData: () => void;
  recoverAllMachines: () => number;
  simulationEnabled: boolean;
  setSimulationEnabled: (enabled: boolean) => void;
}

const AppConfigContext = createContext<AppConfigContextType>({
  isUsingMockData: true,
  isSupabaseConnected: false,
  isApiConfigured: false,
  machines: MOCK_MACHINES,
  jobs: MOCK_JOBS,
  updateMachine: () => {},
  addJob: () => {},
  updateJob: () => {},
  refreshData: () => {},
  recoverAllMachines: () => 0,
  simulationEnabled: true,
  setSimulationEnabled: () => {},
});

export const useAppConfig = () => useContext(AppConfigContext);

/**
 * Must be rendered INSIDE AppConfigContext.Provider so useAppConfig()
 * returns the real addJob/updateJob/updateMachine — not default no-ops.
 * 
 * CRITICAL FIX: Now exports simulated jobs so they can be merged with Supabase data
 */
function SimulationManager({ onSimulatedJobs }: { onSimulatedJobs?: (jobs: ProductionJob[]) => void }) {
  const { simulationEnabled } = useAppConfig();
  const { simulatedJobs } = useAutonomousSimulation({
    enabled: simulationEnabled,
    jobProgressionInterval: 15000,  // 15 seconds - slower progression
    machineEventInterval: 15000,     // 15 seconds - slower machine events
    newJobInterval: 20000,           // 20 seconds - slower job generation
    sensorDataInterval: 10000,       // 10 seconds - slower sensor updates
  });
  
  // Export simulated jobs to parent component
  useEffect(() => {
    if (onSimulatedJobs && simulatedJobs.length > 0) {
      onSimulatedJobs(simulatedJobs);
    }
  }, [simulatedJobs, onSimulatedJobs]);
  
  return null;
}

function App() {
  const { machines: realtimeMachines, isConnected: isSupabaseConnected, refresh: refreshMachines } = useRealtimeMachines();
  const { sensorData } = useLatestSensorData();
  
  // Track simulated jobs from the simulation manager
  const [simulatedJobs, setSimulatedJobs] = useState<ProductionJob[]>([]);
  
  // Pass simulated jobs to useRealtimeJobs for merging with Supabase data
  // CRITICAL: updateJob and addJob work for both real and simulated jobs
  const { 
    jobs: realtimeJobs, 
    refresh: refreshJobs, 
    updateJob: updateRealtimeJob,
    addJob: addRealtimeJob,
    realJobIds 
  } = useRealtimeJobs(undefined, simulatedJobs);
  
  const [activeTab, setActiveTab] = useState<'control-room' | 'dispatch-lab' | 'machine-twin' | 'virtual-metrology' | 'aegis-sentinel' | 'knowledge-graph' | 'chaos-lab' | 'capacity-studio'>('control-room');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const hasTrackingDeepLink =
      Boolean(params.get('jobId')) ||
      Boolean(params.get('linkedJobId')) ||
      Boolean(params.get('q')) ||
      Boolean(params.get('search')) ||
      Boolean(params.get('trackingId')) ||
      Boolean(params.get('trackingCode')) ||
      Boolean(params.get('track'));
    if (hasTrackingDeepLink) {
      setActiveTab('dispatch-lab');
    }
  }, []);

  const hasSupabase = isSupabaseConfigured();
  const hasApi = isApiConfigured();
  const isUsingMockData = !hasSupabase;

  // Local state for mock data (allows modifications in demo mode)
  const [, setLocalMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [, setLocalJobs] = useState<ProductionJob[]>(MOCK_JOBS);

  // Use realtime data if available, otherwise use local mock data
  const [displayMachines, setDisplayMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [displayJobs, setDisplayJobs] = useState<ProductionJob[]>(MOCK_JOBS);
  const hasInitialized = useRef(false);

  // Sync display data with source data
  useEffect(() => {
    if (hasSupabase) {
      // Only update from realtime if we have actual data
      if (realtimeMachines.length > 0) {
        setDisplayMachines(realtimeMachines);
      }
    } else if (!hasInitialized.current) {
      // In demo mode, initialize once with mock data
      setDisplayMachines(MOCK_MACHINES);
      setLocalMachines(MOCK_MACHINES);
    }
  }, [hasSupabase, realtimeMachines]);

  useEffect(() => {
    if (hasSupabase) {
      // Use merged jobs (real + simulated) when Supabase is connected
      if (realtimeJobs.length > 0 || hasInitialized.current) {
        setDisplayJobs(realtimeJobs);
        hasInitialized.current = true;
      }
    } else if (!hasInitialized.current) {
      // In demo mode, initialize once with mock data
      setDisplayJobs(MOCK_JOBS);
      setLocalJobs(MOCK_JOBS);
      hasInitialized.current = true;
    }
  }, [hasSupabase, realtimeJobs]);

  const machinesWithSensorData = useMemo(() => {
    return displayMachines.map((m) => ({
      ...m,
      temperature: sensorData[m.machine_id]?.temperature,
      vibration: sensorData[m.machine_id]?.vibration,
    }));
  }, [displayMachines, sensorData]);

  // Update machine - works for both real and mock data with immediate UI update
  const updateMachine = useCallback((machineId: string, updates: Partial<Machine>) => {
    const updatedMachine = { ...updates, updated_at: new Date().toISOString() };
    
    // Always update local state for immediate UI feedback
    setLocalMachines(prev => prev.map(m => 
      m.machine_id === machineId ? { ...m, ...updatedMachine } : m
    ));
    
    // Also update display machines immediately
    setDisplayMachines(prev => prev.map(m => 
      m.machine_id === machineId ? { ...m, ...updatedMachine } : m
    ));
    
    // If using Supabase, the realtime subscription will eventually sync the real data
  }, []);

  // Add job - works for both real and mock data with immediate UI update
  // CRITICAL: When Supabase is connected, this creates a REAL job in the database
  const addJob = useCallback(async (job: ProductionJob) => {
    // Always update local state for immediate UI feedback
    setLocalJobs(prev => [job, ...prev]);
    setDisplayJobs(prev => [job, ...prev]);
    
    // If using Supabase, add to database
    if (hasSupabase) {
      try {
        await addRealtimeJob(job);
      } catch (err) {
        console.error('Failed to add job to Supabase:', err);
      }
    }
  }, [hasSupabase, addRealtimeJob]);

  // Update job - CRITICAL: works for BOTH real (Supabase) and mock jobs
  // Real jobs get persisted to database, simulated jobs stay in memory
  const updateJob = useCallback(async (jobId: string, updates: Partial<ProductionJob>) => {
    const updatedJob = { ...updates, updated_at: new Date().toISOString() };
    
    // Always update local state for immediate UI feedback
    setLocalJobs(prev => prev.map(j => 
      j.job_id === jobId ? { ...j, ...updatedJob } : j
    ));
    
    // Also update display jobs immediately
    setDisplayJobs(prev => prev.map(j => 
      j.job_id === jobId ? { ...j, ...updatedJob } : j
    ));
    
    // Update in Supabase if it's a real job - this persists the changes!
    if (hasSupabase && realJobIds.has(jobId)) {
      try {
        await updateRealtimeJob(jobId, updates);
      } catch (err) {
        console.error('Failed to update job in Supabase:', err);
      }
    }
  }, [hasSupabase, updateRealtimeJob, realJobIds]);

  // Refresh data
  const refreshData = useCallback(() => {
    if (hasSupabase) {
      refreshMachines();
      refreshJobs();
    }
    // For demo mode, just keep current state
  }, [hasSupabase, refreshMachines, refreshJobs]);

  // Autonomous simulation toggle - works in both demo and Supabase modes
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  
  // NOTE: Simulation is started via <SimulationManager /> inside the Provider below.
  // It MUST be inside the Provider so useAppConfig() returns real functions, not default no-ops.

  // Recover all broken machines at once
  const recoverAllMachines = useCallback(() => {
    const brokenMachines = displayMachines.filter(m => m.status === 'DOWN' || m.status === 'MAINTENANCE');
    brokenMachines.forEach(machine => {
      updateMachine(machine.machine_id, { status: 'IDLE', efficiency_rating: 0.90 });
    });
    return brokenMachines.length;
  }, [displayMachines, updateMachine]);

  const appConfigValue: AppConfigContextType = {
    isUsingMockData,
    isSupabaseConnected,
    isApiConfigured: hasApi,
    machines: machinesWithSensorData,
    jobs: displayJobs,
    updateMachine,
    addJob,
    updateJob,
    refreshData,
    recoverAllMachines,
    simulationEnabled,
    setSimulationEnabled,
  };
  const transvecHref = `${stripTrailingSlash(import.meta.env.VITE_TRANSVEC_BASE_URL || DEFAULT_TRANSVEC_BASE_URL)}/?source=yieldops`;

  return (
    <AppConfigContext.Provider value={appConfigValue}>
      <SimulationManager onSimulatedJobs={setSimulatedJobs} />
      <div className="min-h-screen bg-zinc-50">
        <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 md:h-16">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-xl shadow-lg shadow-zinc-200">
                  <IconBuildingFactory2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-zinc-900 tracking-tight">YieldOps</h1>
                  <p className="text-xs text-zinc-500 font-medium hidden sm:block">Smart Fab Control Tower</p>
                </div>
              </div>

              <nav className="hidden lg:flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl">
                {[
                  { id: 'control-room', label: 'Control Room', icon: IconGauge },
                  { id: 'dispatch-lab', label: 'Dispatch Lab', icon: IconRoute },
                  { id: 'machine-twin', label: 'Machine Twin', icon: IconCpu },
                  { id: 'virtual-metrology', label: 'Virtual Metrology', icon: IconChartBar },
                  { id: 'aegis-sentinel', label: 'Aegis Sentinel', icon: IconShield },
                  { id: 'knowledge-graph', label: 'Knowledge Graph', icon: IconBrain },
                  { id: 'chaos-lab', label: 'Chaos Lab', icon: IconFlask },
                  { id: 'capacity-studio', label: 'Capacity Studio', icon: IconChartHistogram },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-1.5 sm:gap-3">
                <a
                  href={transvecHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
                  title="Open Transvec logistics interface"
                >
                  <IconExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Transvec</span>
                </a>
                {isUsingMockData && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full">
                    <IconAlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Demo Mode</span>
                  </div>
                )}
                
                <button
                  onClick={() => setSimulationEnabled(!simulationEnabled)}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    simulationEnabled 
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                  title="Toggle autonomous simulation"
                >
                  {simulationEnabled ? <IconPlayerPlay className="w-3 h-3" /> : <IconPlayerPause className="w-3 h-3" />}
                  <span className="hidden sm:inline">{simulationEnabled ? 'Simulating' : 'Paused'}</span>
                </button>
                
                <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-zinc-100 rounded-full">
                  {isSupabaseConnected ? (
                    <>
                      <IconWifi className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="hidden sm:inline text-xs font-medium text-zinc-600">Live</span>
                    </>
                  ) : (
                    <>
                      <IconWifiOff className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="hidden sm:inline text-xs font-medium text-zinc-500">Offline</span>
                    </>
                  )}
                </div>
                <button 
                  onClick={refreshData}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <IconRefresh className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
          {activeTab === 'control-room' && (
            <OverviewTab machines={machinesWithSensorData} jobs={displayJobs} />
          )}
          {activeTab === 'dispatch-lab' && (
            <JobsTab jobs={displayJobs} machines={machinesWithSensorData} />
          )}
          {activeTab === 'machine-twin' && (
            <MachinesTab machines={machinesWithSensorData} />
          )}
          {activeTab === 'virtual-metrology' && (
            <NotebooksTab />
          )}
          {activeTab === 'aegis-sentinel' && (
            <SentinelTab />
          )}
          {activeTab === 'knowledge-graph' && (
            <OverviewTab machines={machinesWithSensorData} jobs={displayJobs} />
          )}
          {activeTab === 'chaos-lab' && (
            <MachinesTab machines={machinesWithSensorData} />
          )}
          {activeTab === 'capacity-studio' && (
            <JobsTab jobs={displayJobs} machines={machinesWithSensorData} />
          )}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="flex items-center justify-around overflow-x-auto">
            {[
              { id: 'control-room', label: 'Control', icon: IconGauge },
              { id: 'dispatch-lab', label: 'Dispatch', icon: IconRoute },
              { id: 'machine-twin', label: 'Machines', icon: IconCpu },
              { id: 'aegis-sentinel', label: 'Aegis', icon: IconShield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 min-h-[48px] transition-colors ${
                  activeTab === tab.id
                    ? 'text-amber-700'
                    : 'text-zinc-500'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </AppConfigContext.Provider>
  );
}

export default App;
