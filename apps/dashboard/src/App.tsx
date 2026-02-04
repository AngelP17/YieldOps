import { useState, useMemo } from 'react';
import { Machine } from './types';
import { useRealtimeMachines, useLatestSensorData, useRealtimeJobs } from './hooks/useRealtime';
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
  RefreshCw
} from 'lucide-react';

// Mock data for demo when Supabase is not configured
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
];

const MOCK_JOBS: any[] = [
  { job_id: '1', job_name: 'WF-2024-0847', wafer_count: 25, priority_level: 1, status: 'RUNNING', recipe_type: 'N5-STD', assigned_machine_id: '1', estimated_duration_minutes: 120, actual_start_time: '2024-01-01', actual_end_time: null, deadline: '2024-01-02', customer_tag: 'Apple', is_hot_lot: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '2', job_name: 'WF-2024-0848', wafer_count: 50, priority_level: 2, status: 'RUNNING', recipe_type: 'N7-EXP', assigned_machine_id: '4', estimated_duration_minutes: 180, actual_start_time: '2024-01-01', actual_end_time: null, deadline: '2024-01-03', customer_tag: 'Samsung', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '3', job_name: 'WF-2024-0849', wafer_count: 30, priority_level: 1, status: 'QUEUED', recipe_type: 'N5-HOT', assigned_machine_id: null, estimated_duration_minutes: 90, actual_start_time: null, actual_end_time: null, deadline: '2024-01-02', customer_tag: 'NVIDIA', is_hot_lot: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '4', job_name: 'WF-2024-0850', wafer_count: 40, priority_level: 3, status: 'QUEUED', recipe_type: 'N7-STD', assigned_machine_id: null, estimated_duration_minutes: 150, actual_start_time: null, actual_end_time: null, deadline: '2024-01-04', customer_tag: 'AMD', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { job_id: '5', job_name: 'WF-2024-0851', wafer_count: 20, priority_level: 2, status: 'PENDING', recipe_type: 'N3-EXP', assigned_machine_id: null, estimated_duration_minutes: 200, actual_start_time: null, actual_end_time: null, deadline: '2024-01-03', customer_tag: 'Qualcomm', is_hot_lot: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

function App() {
  const { machines: realtimeMachines, isConnected } = useRealtimeMachines();
  const { sensorData } = useLatestSensorData();
  const { jobs: realtimeJobs } = useRealtimeJobs();
  const [activeTab, setActiveTab] = useState<'overview' | 'machines' | 'jobs'>('overview');

  const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_url';
  const machines = hasSupabase ? realtimeMachines : MOCK_MACHINES;
  const jobs = hasSupabase ? realtimeJobs : MOCK_JOBS;

  const machinesWithSensorData = useMemo(() => {
    return machines.map((m) => ({
      ...m,
      temperature: sensorData[m.machine_id]?.temperature,
      vibration: sensorData[m.machine_id]?.vibration,
    }));
  }, [machines, sensorData]);

  return (
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
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                {isConnected ? (
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
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab machines={machinesWithSensorData} jobs={jobs} />
        )}
        {activeTab === 'machines' && (
          <MachinesTab machines={machinesWithSensorData} />
        )}
        {activeTab === 'jobs' && (
          <JobsTab jobs={jobs} machines={machines} />
        )}
      </main>
    </div>
  );
}

export default App;
