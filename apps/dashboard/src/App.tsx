import { useState, useMemo } from 'react';
import { MachineNode } from './components/MachineNode';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ChaosPanel } from './components/ChaosPanel';
import { DecisionLog } from './components/DecisionLog';
import { Machine } from './types';
import { useRealtimeMachines, useLatestSensorData, useRealtimeJobs } from './hooks/useRealtime';
import { 
  Activity, 
  Cpu, 
  Settings, 
  Zap, 
  Package, 
  Clock,
  TrendingUp,
  Factory,
  ChevronRight,
  BarChart3,
  Layers,
  Shield,
  Wifi,
  WifiOff,
  MoreHorizontal,
  Filter,
  Download,
  RefreshCw,
  Bomb,
  Brain
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

const MOCK_JOBS = [
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
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'machines' | 'jobs' | 'chaos' | 'decisions'>('overview');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  
  // Use mock data if Supabase is not configured
  const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_url';
  const machines = hasSupabase ? realtimeMachines : MOCK_MACHINES;
  const jobs = hasSupabase ? realtimeJobs : MOCK_JOBS;

  // Merge machines with latest sensor data
  const machinesWithSensorData = useMemo(() => {
    return machines.map((m) => ({
      ...m,
      temperature: sensorData[m.machine_id]?.temperature,
      vibration: sensorData[m.machine_id]?.vibration,
    }));
  }, [machines, sensorData]);

  // Statistics
  const stats = useMemo(() => {
    const total = machines.length;
    const running = machines.filter((m) => m.status === 'RUNNING').length;
    const idle = machines.filter((m) => m.status === 'IDLE').length;
    const down = machines.filter((m) => m.status === 'DOWN').length;
    const maintenance = machines.filter((m) => m.status === 'MAINTENANCE').length;
    const avgEfficiency = running > 0
      ? machines.filter(m => m.status === 'RUNNING').reduce((acc, m) => acc + m.efficiency_rating, 0) / running
      : 0;
    
    const totalWafers = machines.reduce((acc, m) => acc + m.current_wafer_count, 0);
    const totalProcessed = machines.reduce((acc, m) => acc + m.total_wafers_processed, 0);
    
    // Job stats
    const pendingJobs = jobs.filter((j) => j.status === 'PENDING').length;
    const queuedJobs = jobs.filter((j) => j.status === 'QUEUED').length;
    const runningJobs = jobs.filter((j) => j.status === 'RUNNING').length;
    const hotLots = jobs.filter((j) => j.is_hot_lot && (j.status === 'PENDING' || j.status === 'QUEUED')).length;

    return {
      total,
      running,
      idle,
      down,
      maintenance,
      avgEfficiency,
      totalWafers,
      totalProcessed,
      pendingJobs,
      queuedJobs,
      runningJobs,
      hotLots,
    };
  }, [machines, jobs]);

  // Group machines by type for display
  const machinesByType = useMemo(() => {
    const grouped: Record<string, Machine[]> = {};
    machinesWithSensorData.forEach((m) => {
      if (!grouped[m.type]) {
        grouped[m.type] = [];
      }
      grouped[m.type].push(m);
    });
    return grouped;
  }, [machinesWithSensorData]);

  const typeOrder = ['lithography', 'etching', 'deposition', 'inspection', 'cleaning'];
  const typeLabels: Record<string, string> = {
    lithography: 'Lithography',
    etching: 'Etching',
    deposition: 'Deposition',
    inspection: 'Inspection',
    cleaning: 'Cleaning',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-200">
                <Factory className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">YieldOps</h1>
                <p className="text-xs text-slate-500 font-medium">Smart Manufacturing Platform</p>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'machines', label: 'Machines', icon: Cpu },
                { id: 'jobs', label: 'Jobs', icon: Layers },
                { id: 'chaos', label: 'Chaos', icon: Bomb },
                { id: 'decisions', label: 'AI Log', icon: Brain },
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

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Connection Status */}
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
        {/* KPI Cards Row - Only show on overview */}
        {activeTab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <KpiCard 
            label="Total Machines"
            value={stats.total}
            subtext={`${stats.running} active`}
            icon={Cpu}
            trend="+2"
            color="blue"
          />
          <KpiCard 
            label="Running"
            value={stats.running}
            subtext={`${((stats.running / stats.total) * 100).toFixed(0)}% uptime`}
            icon={Activity}
            trend="+5%"
            color="emerald"
          />
          <KpiCard 
            label="Efficiency"
            value={`${(stats.avgEfficiency * 100).toFixed(1)}%`}
            subtext="Avg. performance"
            icon={TrendingUp}
            trend="+1.2%"
            color="indigo"
          />
          <KpiCard 
            label="Wafers In Process"
            value={stats.totalWafers}
            subtext={`${stats.totalProcessed.toLocaleString()} total`}
            icon={Layers}
            trend="+12"
            color="amber"
          />
          <KpiCard 
            label="Active Jobs"
            value={stats.runningJobs + stats.queuedJobs}
            subtext={`${stats.hotLots} hot lots`}
            icon={Package}
            trend="+3"
            color="purple"
          />
          <KpiCard 
            label="Alerts"
            value={stats.down + stats.maintenance}
            subtext="Require attention"
            icon={Shield}
            trend="-1"
            color="rose"
          />
        </div>
        )}

        {/* Tab Content */}
        {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Machine Floor */}
          <div className="xl:col-span-2 space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Fab Floor</h2>
                <p className="text-sm text-slate-500">Real-time machine status and performance</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Machine Groups */}
            <div className="space-y-6">
              {typeOrder.map((type) => {
                const typeMachines = machinesByType[type];
                if (!typeMachines || typeMachines.length === 0) return null;
                
                const runningCount = typeMachines.filter(m => m.status === 'RUNNING').length;
                
                return (
                  <div key={type} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-white rounded-lg border border-slate-200">
                          <Settings className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{typeLabels[type]}</h3>
                          <p className="text-xs text-slate-500">{typeMachines.length} units • {runningCount} running</p>
                        </div>
                      </div>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {typeMachines.map((machine) => (
                          <MachineNode
                            key={machine.machine_id}
                            machine={machine}
                            onClick={setSelectedMachine}
                            isSelected={selectedMachine?.machine_id === machine.machine_id}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Jobs & Details */}
          <div className="space-y-6">
            {/* Selected Machine Details */}
            {selectedMachine ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      selectedMachine.status === 'RUNNING' ? 'bg-emerald-400 animate-pulse' :
                      selectedMachine.status === 'IDLE' ? 'bg-amber-400' :
                      selectedMachine.status === 'DOWN' ? 'bg-rose-400' :
                      'bg-slate-400'
                    }`} />
                    <div>
                      <h3 className="text-sm font-semibold text-white">{selectedMachine.name}</h3>
                      <p className="text-xs text-slate-400">{selectedMachine.machine_id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMachine(null)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Status</span>
                    <StatusBadge status={selectedMachine.status} />
                  </div>
                  
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <DetailMetric 
                      label="Efficiency" 
                      value={`${(selectedMachine.efficiency_rating * 100).toFixed(1)}%`}
                      icon={TrendingUp}
                    />
                    <DetailMetric 
                      label="Wafers" 
                      value={selectedMachine.current_wafer_count.toString()}
                      subvalue={`${selectedMachine.total_wafers_processed.toLocaleString()} total`}
                      icon={Layers}
                    />
                    <DetailMetric 
                      label="Temperature" 
                      value={selectedMachine.temperature ? `${selectedMachine.temperature.toFixed(1)}°C` : '—'}
                      icon={Zap}
                    />
                    <DetailMetric 
                      label="Vibration" 
                      value={selectedMachine.vibration ? selectedMachine.vibration.toFixed(2) : '—'}
                      icon={Activity}
                    />
                  </div>

                  {/* Location & Maintenance */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Location</span>
                      <span className="font-medium text-slate-900">{selectedMachine.location_zone}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Last Maintenance</span>
                      <span className="font-medium text-slate-900">
                        {new Date(selectedMachine.last_maintenance || '').toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button 
                    onClick={() => setIsAnalyticsOpen(true)}
                    className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    View Detailed Analytics
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mx-auto mb-4">
                  <Cpu className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 mb-1">No Machine Selected</h3>
                <p className="text-xs text-slate-500">Click on a machine to view detailed metrics</p>
              </div>
            )}

            {/* Jobs Queue */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Production Queue</h3>
                  <p className="text-xs text-slate-500">{jobs.length} jobs total</p>
                </div>
                <button className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View All
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {jobs.slice(0, 5).map((job) => (
                  <div key={job.job_id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{job.job_name}</span>
                          {job.is_hot_lot && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded">
                              HOT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{job.customer_tag} • {job.recipe_type}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {job.wafer_count} wafers
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        P{job.priority_level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'machines' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">All Machines</h2>
                <p className="text-sm text-slate-500">Complete machine inventory and status</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {machines.map((machine) => (
                  <MachineNode
                    key={machine.machine_id}
                    machine={machine}
                    onClick={setSelectedMachine}
                    isSelected={selectedMachine?.machine_id === machine.machine_id}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Production Jobs</h2>
                  <p className="text-sm text-slate-500">All jobs in the production queue</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <div key={job.job_id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{job.job_name}</span>
                          {job.is_hot_lot && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded">
                              HOT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{job.customer_tag} • {job.recipe_type}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center gap-6 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {job.wafer_count} wafers
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        P{job.priority_level} Priority
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {job.assigned_machine_id || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chaos' && <ChaosPanel />}
        {activeTab === 'decisions' && <DecisionLog />}
      </main>

      {/* Analytics Modal */}
      <AnalyticsModal
        machine={selectedMachine}
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
    </div>
  );
}

// KPI Card Component
interface KpiCardProps {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ElementType;
  trend: string;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';
}

const colorStyles = {
  blue: 'from-blue-500 to-blue-600 shadow-blue-200',
  emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-200',
  amber: 'from-amber-500 to-amber-600 shadow-amber-200',
  rose: 'from-rose-500 to-rose-600 shadow-rose-200',
  indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200',
  purple: 'from-purple-500 to-purple-600 shadow-purple-200',
};

function KpiCard({ label, value, subtext, icon: Icon, trend, color }: KpiCardProps) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${colorStyles[color]} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-[10px] text-slate-400">{subtext}</p>
    </div>
  );
}

// Detail Metric Component
interface DetailMetricProps {
  label: string;
  value: string;
  subvalue?: string;
  icon: React.ElementType;
}

function DetailMetric({ label, value, subvalue, icon: Icon }: DetailMetricProps) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      {subvalue && <p className="text-[10px] text-slate-400 mt-0.5">{subvalue}</p>}
    </div>
  );
}

// Status Badge Component
interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    RUNNING: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    IDLE: 'bg-amber-100 text-amber-700 border-amber-200',
    DOWN: 'bg-rose-100 text-rose-700 border-rose-200',
    MAINTENANCE: 'bg-slate-100 text-slate-700 border-slate-200',
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    QUEUED: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
    FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.IDLE}`}>
      {status}
    </span>
  );
}

// Job Status Badge
interface JobStatusBadgeProps {
  status: string;
}

function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    QUEUED: 'bg-blue-100 text-blue-700',
    RUNNING: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-slate-100 text-slate-700',
    FAILED: 'bg-rose-100 text-rose-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

export default App;
