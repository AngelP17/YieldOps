import { useState, useMemo } from 'react';
import { MachineNode } from './components/MachineNode';
import { Machine } from './types';
import { useRealtimeMachines, useLatestSensorData, useRealtimeJobs } from './hooks/useRealtime';
import { Activity, Cpu, Settings, Zap, Package, AlertCircle, Clock } from 'lucide-react';

function App() {
  const { machines, isConnected } = useRealtimeMachines();
  const { sensorData } = useLatestSensorData();
  const { jobs } = useRealtimeJobs();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

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
    const avgEfficiency = total > 0
      ? machines.reduce((acc, m) => acc + m.efficiency_rating, 0) / total
      : 0;
    
    // Job stats
    const pendingJobs = jobs.filter((j) => j.status === 'PENDING').length;
    const hotLots = jobs.filter((j) => j.is_hot_lot && j.status === 'PENDING').length;

    return {
      total,
      running,
      idle,
      down,
      maintenance,
      avgEfficiency,
      pendingJobs,
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Smart Fab</h1>
                <p className="text-xs text-gray-500">TSMC Intelligent Manufacturing</p>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <StatCard 
            icon={Cpu} 
            label="Total" 
            value={stats.total} 
            color="blue" 
          />
          <StatCard 
            icon={Activity} 
            label="Running" 
            value={stats.running} 
            color="emerald" 
          />
          <StatCard 
            icon={Zap} 
            label="Idle" 
            value={stats.idle} 
            color="amber" 
          />
          <StatCard 
            icon={AlertCircle} 
            label="Down" 
            value={stats.down} 
            color="red" 
          />
          <StatCard 
            icon={Settings} 
            label="Maint." 
            value={stats.maintenance} 
            color="purple" 
          />
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Efficiency</p>
            <p className={`text-2xl font-bold ${
              stats.avgEfficiency >= 0.9 ? 'text-emerald-600' :
              stats.avgEfficiency >= 0.8 ? 'text-blue-600' :
              stats.avgEfficiency >= 0.7 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {(stats.avgEfficiency * 100).toFixed(0)}%
            </p>
          </div>
          <StatCard 
            icon={Package} 
            label="Pending" 
            value={stats.pendingJobs} 
            color="indigo" 
          />
          <StatCard 
            icon={Clock} 
            label="Hot Lots" 
            value={stats.hotLots} 
            color="orange" 
          />
        </div>

        {/* Machine Grid by Type */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fab Floor</h2>
          
          {typeOrder.map((type) => {
            const typeMachines = machinesByType[type];
            if (!typeMachines || typeMachines.length === 0) return null;
            
            return (
              <div key={type} className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  {type.replace('_', ' ')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            );
          })}
        </div>

        {/* Selected Machine Details */}
        {selectedMachine && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedMachine.name} Details
              </h3>
              <button
                onClick={() => setSelectedMachine(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DetailItem label="Machine ID" value={selectedMachine.machine_id.slice(0, 8) + '...'} />
              <DetailItem label="Type" value={selectedMachine.type.replace('_', ' ')} />
              <DetailItem label="Location" value={selectedMachine.location_zone} />
              <DetailItem label="Status" value={selectedMachine.status} />
              <DetailItem 
                label="Efficiency" 
                value={`${(selectedMachine.efficiency_rating * 100).toFixed(1)}%`} 
              />
              <DetailItem label="Wafers" value={selectedMachine.current_wafer_count.toString()} />
              <DetailItem 
                label="Temperature" 
                value={selectedMachine.temperature ? `${selectedMachine.temperature.toFixed(1)}°C` : 'N/A'} 
              />
              <DetailItem 
                label="Vibration" 
                value={selectedMachine.vibration ? selectedMachine.vibration.toFixed(2) : 'N/A'} 
              />
            </div>
          </div>
        )}

        {/* Jobs Summary */}
        {jobs.length > 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Jobs</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wafers</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hot Lot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {jobs.slice(0, 10).map((job) => (
                    <tr key={job.job_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{job.job_name}</td>
                      <td className="px-4 py-2 text-sm">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">P{job.priority_level}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{job.wafer_count}</td>
                      <td className="px-4 py-2 text-sm">
                        {job.is_hot_lot ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            HOT
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'indigo' | 'orange';
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
};

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className={`rounded-xl p-4 border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value: string;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    QUEUED: 'bg-blue-100 text-blue-800',
    RUNNING: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export default App;
