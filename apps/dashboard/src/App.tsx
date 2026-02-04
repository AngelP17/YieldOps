import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react';
import { Machine, ProductionJob } from './types';
import { useRealtimeMachines, useLatestSensorData, useRealtimeJobs } from './hooks/useRealtime';
import { useAutonomousSimulation } from './hooks/useAutonomousSimulation';
import { isApiConfigured, isSupabaseConfigured } from './services/apiClient';
import { OverviewTab } from './components/tabs/OverviewTab';
import { MachinesTab } from './components/tabs/MachinesTab';
import { JobsTab } from './components/tabs/JobsTab';
import {
  Factory,
  BarChart3,
  Cpu,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause
} from 'lucide-react';

// Extended mock data for demo when Supabase is not configured
const MOCK_MACHINES: Machine[] = [
  { machine_id: '1', name: 'Litho-A1', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.95, location_zone: 'Bay A', max_temperature: 80, max_vibration: 5, current_wafer_count: 12, total_wafers_processed: 15234, last_maintenance: '2024-01-15', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '2', name: 'Litho-A2', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.92, location_zone: 'Bay A', max_temperature: 80, max_vibration: 5, current_wafer_count: 8, total_wafers_processed: 12890, last_maintenance: '2024-01-20', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '3', name: 'Litho-B1', type: 'lithography', status: 'IDLE', efficiency_rating: 0.88, location_zone: 'Bay B', max_temperature: 80, max_vibration: 5, current_wafer_count: 0, total_wafers_processed: 11500, last_maintenance: '2024-02-01', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '4', name: 'Etch-C1', type: 'etching', status: 'RUNNING', efficiency_rating: 0.94, location_zone: 'Bay C', max_temperature: 100, max_vibration: 8, current_wafer_count: 15, total_wafers_processed: 18900, last_maintenance: '2024-01-10', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '5', name: 'Etch-C2', type: 'etching', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'Bay C', max_temperature: 100, max_vibration: 8, current_wafer_count: 10, total_wafers_processed: 16200, last_maintenance: '2024-01-25', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '6', name: 'Etch-D1', type: 'etching', status: 'DOWN', efficiency_rating: 0.00, location_zone: 'Bay D', max_temperature: 100, max_vibration: 8, current_wafer_count: 0, total_wafers_processed: 9800, last_maintenance: '2024-02-10', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '7', name: 'Dep-E1', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.93, location_zone: 'Bay E', max_temperature: 120, max_vibration: 3, current_wafer_count: 18, total_wafers_processed: 21400, last_maintenance: '2024-01-18', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '8', name: 'Dep-E2', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.89, location_zone: 'Bay E', max_temperature: 120, max_vibration: 3, current_wafer_count: 12, total_wafers_processed: 19800, last_maintenance: '2024-01-30', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '9', name: 'Insp-F1', type: 'inspection', status: 'MAINTENANCE', efficiency_rating: 0.00, location_zone: 'Bay F', max_temperature: 40, max_vibration: 2, current_wafer_count: 0, total_wafers_processed: 8500, last_maintenance: '2024-02-15', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '10', name: 'Insp-F2', type: 'inspection', status: 'RUNNING', efficiency_rating: 0.96, location_zone: 'Bay F', max_temperature: 40, max_vibration: 2, current_wafer_count: 5, total_wafers_processed: 11200, last_maintenance: '2024-01-22', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '11', name: 'Clean-G1', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.94, location_zone: 'Bay G', max_temperature: 60, max_vibration: 4, current_wafer_count: 22, total_wafers_processed: 25600, last_maintenance: '2024-01-12', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '12', name: 'Clean-G2', type: 'cleaning', status: 'IDLE', efficiency_rating: 0.90, location_zone: 'Bay G', max_temperature: 60, max_vibration: 4, current_wafer_count: 0, total_wafers_processed: 23100, last_maintenance: '2024-02-05', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '13', name: 'Implant-H1', type: 'etching', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'Bay H', max_temperature: 85, max_vibration: 6, current_wafer_count: 14, total_wafers_processed: 18700, last_maintenance: '2024-01-28', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '14', name: 'Implant-H2', type: 'etching', status: 'IDLE', efficiency_rating: 0.87, location_zone: 'Bay H', max_temperature: 85, max_vibration: 6, current_wafer_count: 0, total_wafers_processed: 16500, last_maintenance: '2024-02-08', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '15', name: 'CVD-I1', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.92, location_zone: 'Bay I', max_temperature: 110, max_vibration: 2, current_wafer_count: 16, total_wafers_processed: 22100, last_maintenance: '2024-01-16', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { machine_id: '16', name: 'CMP-J1', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.89, location_zone: 'Bay J', max_temperature: 55, max_vibration: 5, current_wafer_count: 20, total_wafers_processed: 24300, last_maintenance: '2024-01-24', created_at: '2024-01-01', updated_at: '2024-01-01' },
];

const MOCK_JOBS: ProductionJob[] = [
  { job_id: '1', job_name: 'WF-2024-0847', wafer_count: 25, priority_level: 1, status: 'RUNNING', recipe_type: 'N5-STD', assigned_machine_id: '1', estimated_duration_minutes: 120, actual_start_time: '2024-01-01', deadline: '2024-01-02', customer_tag: 'Apple', is_hot_lot: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '2', job_name: 'WF-2024-0848', wafer_count: 50, priority_level: 2, status: 'RUNNING', recipe_type: 'N7-EXP', assigned_machine_id: '4', estimated_duration_minutes: 180, actual_start_time: '2024-01-01', deadline: '2024-01-03', customer_tag: 'Samsung', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '3', job_name: 'WF-2024-0849', wafer_count: 30, priority_level: 1, status: 'QUEUED', recipe_type: 'N5-HOT', estimated_duration_minutes: 90, deadline: '2024-01-02', customer_tag: 'NVIDIA', is_hot_lot: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '4', job_name: 'WF-2024-0850', wafer_count: 40, priority_level: 3, status: 'QUEUED', recipe_type: 'N7-STD', estimated_duration_minutes: 150, deadline: '2024-01-04', customer_tag: 'AMD', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '5', job_name: 'WF-2024-0851', wafer_count: 20, priority_level: 2, status: 'PENDING', recipe_type: 'N3-EXP', estimated_duration_minutes: 200, deadline: '2024-01-03', customer_tag: 'Qualcomm', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '6', job_name: 'WF-2024-0852', wafer_count: 35, priority_level: 1, status: 'PENDING', recipe_type: 'N5-STD', estimated_duration_minutes: 130, deadline: '2024-01-05', customer_tag: 'Intel', is_hot_lot: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '7', job_name: 'WF-2024-0853', wafer_count: 45, priority_level: 3, status: 'PENDING', recipe_type: 'N7-EXP', estimated_duration_minutes: 170, deadline: '2024-01-06', customer_tag: 'MediaTek', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '8', job_name: 'WF-2024-0854', wafer_count: 25, priority_level: 2, status: 'COMPLETED', recipe_type: 'N3-STD', assigned_machine_id: '7', estimated_duration_minutes: 110, actual_start_time: '2024-01-01', actual_end_time: '2024-01-01', deadline: '2024-01-02', customer_tag: 'Broadcom', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

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
});

export const useAppConfig = () => useContext(AppConfigContext);

function App() {
  const { machines: realtimeMachines, isConnected: isSupabaseConnected, refresh: refreshMachines } = useRealtimeMachines();
  const { sensorData } = useLatestSensorData();
  const { jobs: realtimeJobs, refresh: refreshJobs } = useRealtimeJobs();
  const [activeTab, setActiveTab] = useState<'overview' | 'machines' | 'jobs'>('overview');

  const hasSupabase = isSupabaseConfigured();
  const hasApi = isApiConfigured();
  const isUsingMockData = !hasSupabase;

  // Local state for mock data (allows modifications in demo mode)
  const [localMachines, setLocalMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [localJobs, setLocalJobs] = useState<ProductionJob[]>(MOCK_JOBS);

  // Use realtime data if available, otherwise use local mock data
  // When Supabase is connected, we use realtime data but still allow local modifications
  // for immediate UI feedback before the realtime update comes through
  const [displayMachines, setDisplayMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [displayJobs, setDisplayJobs] = useState<ProductionJob[]>(MOCK_JOBS);

  // Sync display data with source data
  useEffect(() => {
    if (hasSupabase) {
      setDisplayMachines(realtimeMachines);
    } else {
      // In demo mode, always use localMachines (which starts with MOCK_MACHINES)
      setDisplayMachines(localMachines);
    }
  }, [hasSupabase, realtimeMachines, localMachines]);

  // Ensure mock data is loaded on initial mount in demo mode
  useEffect(() => {
    if (!hasSupabase && displayMachines.length === 0) {
      setDisplayMachines(MOCK_MACHINES);
      setLocalMachines(MOCK_MACHINES);
    }
    if (!hasSupabase && displayJobs.length === 0) {
      setDisplayJobs(MOCK_JOBS);
      setLocalJobs(MOCK_JOBS);
    }
  }, [hasSupabase]);

  useEffect(() => {
    if (hasSupabase) {
      setDisplayJobs(realtimeJobs);
    } else {
      setDisplayJobs(localJobs);
    }
  }, [hasSupabase, realtimeJobs, localJobs]);

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
  const addJob = useCallback((job: ProductionJob) => {
    // Always add to local state for immediate UI feedback
    setLocalJobs(prev => [job, ...prev]);
    
    // Also update display jobs immediately
    setDisplayJobs(prev => [job, ...prev]);
    
    // If using Supabase, refresh to get the real data
    if (hasSupabase) {
      setTimeout(() => refreshJobs(), 500);
    }
  }, [hasSupabase, refreshJobs]);

  // Update job - works for both real and mock data with immediate UI update
  const updateJob = useCallback((jobId: string, updates: Partial<ProductionJob>) => {
    const updatedJob = { ...updates, updated_at: new Date().toISOString() };
    
    // Always update local state for immediate UI feedback
    setLocalJobs(prev => prev.map(j => 
      j.job_id === jobId ? { ...j, ...updatedJob } : j
    ));
    
    // Also update display jobs immediately
    setDisplayJobs(prev => prev.map(j => 
      j.job_id === jobId ? { ...j, ...updatedJob } : j
    ));
    
    // If using Supabase, the realtime subscription will eventually sync the real data
  }, []);

  // Refresh data
  const refreshData = useCallback(() => {
    if (hasSupabase) {
      refreshMachines();
      refreshJobs();
    }
    // For demo mode, just keep current state
  }, [hasSupabase, refreshMachines, refreshJobs]);

  // Autonomous simulation toggle
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  
  // Start autonomous simulation in demo mode
  useAutonomousSimulation({
    enabled: simulationEnabled && isUsingMockData,
    jobProgressionInterval: 5000,
    machineEventInterval: 8000,
    newJobInterval: 15000,
    sensorDataInterval: 3000,
  });

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
  };

  return (
    <AppConfigContext.Provider value={appConfigValue}>
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-200">
                  <Factory className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">YieldOps</h1>
                  <p className="text-xs text-slate-500 font-medium">Smart Manufacturing Platform</p>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'machines', label: 'Machines', icon: Cpu },
                  { id: 'jobs', label: 'Jobs', icon: Layers },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                {/* Mock Data Badge */}
                {isUsingMockData && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Demo Mode</span>
                    </div>
                    {/* Simulation Toggle */}
                    <button
                      onClick={() => setSimulationEnabled(!simulationEnabled)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                        simulationEnabled 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Toggle autonomous simulation"
                    >
                      {simulationEnabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      {simulationEnabled ? 'Simulating' : 'Paused'}
                    </button>
                  </>
                )}
                
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                  {isSupabaseConnected ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-medium text-slate-600">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-500">Offline</span>
                    </>
                  )}
                </div>
                <button 
                  onClick={refreshData}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 lg:px-8 py-8">
          {activeTab === 'overview' && (
            <OverviewTab machines={machinesWithSensorData} jobs={displayJobs} />
          )}
          {activeTab === 'machines' && (
            <MachinesTab machines={machinesWithSensorData} />
          )}
          {activeTab === 'jobs' && (
            <JobsTab jobs={displayJobs} machines={machinesWithSensorData} />
          )}
        </main>
      </div>
    </AppConfigContext.Provider>
  );
}

export default App;
