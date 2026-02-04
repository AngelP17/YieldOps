import { useMemo } from 'react';
import { Machine } from '../types';
import {
  X,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Layers,
  Cpu,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface AnalyticsModalProps {
  machine: Machine | null;
  isOpen: boolean;
  onClose: () => void;
}

// Mock historical data for charts
const generateMockHistory = () => {
  const hours = 24;
  const data = [];
  for (let i = 0; i < hours; i++) {
    data.push({
      hour: i,
      efficiency: 0.85 + Math.random() * 0.12,
      temperature: 60 + Math.random() * 20,
      vibration: 2 + Math.random() * 3,
    });
  }
  return data;
};

// Mock job history
const generateMockJobHistory = () => {
  return [
    { id: '1', name: 'WF-2024-0842', wafers: 25, duration: 118, status: 'COMPLETED', time: '2h ago' },
    { id: '2', name: 'WF-2024-0841', wafers: 50, duration: 185, status: 'COMPLETED', time: '5h ago' },
    { id: '3', name: 'WF-2024-0840', wafers: 30, duration: 92, status: 'COMPLETED', time: '8h ago' },
    { id: '4', name: 'WF-2024-0839', wafers: 40, duration: 155, status: 'COMPLETED', time: '12h ago' },
    { id: '5', name: 'WF-2024-0838', wafers: 20, duration: 210, status: 'FAILED', time: '1d ago' },
  ];
};

export function AnalyticsModal({ machine, isOpen, onClose }: AnalyticsModalProps) {
  if (!isOpen || !machine) return null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const historyData = useMemo(() => generateMockHistory(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const jobHistory = useMemo(() => generateMockJobHistory(), []);

  // Calculate stats
  const avgEfficiency = historyData.reduce((acc, d) => acc + d.efficiency, 0) / historyData.length;
  const avgVibration = historyData.reduce((acc, d) => acc + d.vibration, 0) / historyData.length;
  const maxTemp = Math.max(...historyData.map(d => d.temperature));

  const completedJobs = jobHistory.filter(j => j.status === 'COMPLETED').length;
  const totalWafersProcessed = jobHistory.reduce((acc, j) => acc + j.wafers, 0);
  const avgJobDuration = jobHistory
    .filter(j => j.status === 'COMPLETED')
    .reduce((acc, j) => acc + j.duration, 0) / completedJobs;

  // Trend calculation (compare last 6 hours vs previous 6 hours)
  const recentEfficiency = historyData.slice(-6).reduce((acc, d) => acc + d.efficiency, 0) / 6;
  const previousEfficiency = historyData.slice(-12, -6).reduce((acc, d) => acc + d.efficiency, 0) / 6;
  const efficiencyTrend = recentEfficiency - previousEfficiency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${
              machine.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' :
              machine.status === 'IDLE' ? 'bg-amber-500' :
              machine.status === 'DOWN' ? 'bg-rose-500' :
              'bg-slate-400'
            }`} />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{machine.name}</h2>
              <p className="text-sm text-slate-500">{machine.type} • {machine.machine_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard
              label="24h Avg Efficiency"
              value={`${(avgEfficiency * 100).toFixed(1)}%`}
              trend={efficiencyTrend}
              icon={TrendingUp}
              color="emerald"
            />
            <MetricCard
              label="Wafers Processed"
              value={totalWafersProcessed.toString()}
              subtext="Last 24h"
              icon={Layers}
              color="blue"
            />
            <MetricCard
              label="Avg Job Duration"
              value={`${avgJobDuration.toFixed(0)}m`}
              subtext="Per job"
              icon={Clock}
              color="amber"
            />
            <MetricCard
              label="Jobs Completed"
              value={completedJobs.toString()}
              subtext={`${jobHistory.length - completedJobs} failed`}
              icon={Cpu}
              color="indigo"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Efficiency Chart */}
            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Efficiency (24h)</h3>
                </div>
                <span className="text-xs text-slate-500">Avg: {(avgEfficiency * 100).toFixed(1)}%</span>
              </div>
              <div className="h-32 flex items-end gap-1">
                {historyData.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-emerald-500/80 rounded-t"
                    style={{ height: `${d.efficiency * 100}%` }}
                    title={`Hour ${d.hour}: ${(d.efficiency * 100).toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>-24h</span>
                <span>-12h</span>
                <span>Now</span>
              </div>
            </div>

            {/* Temperature Chart */}
            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Temperature (24h)</h3>
                </div>
                <span className="text-xs text-slate-500">Max: {maxTemp.toFixed(1)}°C</span>
              </div>
              <div className="h-32 flex items-end gap-1">
                {historyData.map((d, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${d.temperature > machine.max_temperature * 0.9 ? 'bg-rose-500' : 'bg-amber-500/80'}`}
                    style={{ height: `${(d.temperature / (machine.max_temperature * 1.2)) * 100}%` }}
                    title={`Hour ${d.hour}: ${d.temperature.toFixed(1)}°C`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>-24h</span>
                <span>-12h</span>
                <span>Now</span>
              </div>
            </div>
          </div>

          {/* Vibration & Sensor Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <SensorStatCard
              label="Avg Vibration"
              value={avgVibration.toFixed(2)}
              unit="mm/s"
              max={machine.max_vibration}
              current={machine.vibration}
              icon={Activity}
            />
            <SensorStatCard
              label="Current Temperature"
              value={machine.temperature ? machine.temperature.toFixed(1) : '—'}
              unit="°C"
              max={machine.max_temperature}
              current={machine.temperature}
              icon={Zap}
            />
            <SensorStatCard
              label="Uptime"
              value="23.5"
              unit="hours"
              subtext="99.2% availability"
              icon={Calendar}
            />
          </div>

          {/* Recent Jobs Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Recent Jobs</h3>
              </div>
              <button className="text-xs font-medium text-blue-600 hover:text-blue-700">
                View All History
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Job ID</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Wafers</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobHistory.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-900">{job.name}</td>
                      <td className="px-5 py-3 text-slate-600">{job.wafers}</td>
                      <td className="px-5 py-3 text-slate-600">{job.duration}m</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'COMPLETED' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{job.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <div className="text-xs text-slate-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Close
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
              Export Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: number;
  icon: React.ElementType;
  color: 'emerald' | 'blue' | 'amber' | 'indigo' | 'rose';
}

function MetricCard({ label, value, subtext, trend, icon: Icon, color }: MetricCardProps) {
  const colorStyles = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorStyles[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-slate-500'
          }`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : 
             trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : 
             <Minus className="w-3 h-3" />}
            {Math.abs(trend * 100).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {subtext && <p className="text-[10px] text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}

// Sensor Stat Card Component
interface SensorStatCardProps {
  label: string;
  value: string;
  unit: string;
  max?: number;
  current?: number;
  subtext?: string;
  icon: React.ElementType;
}

function SensorStatCard({ label, value, unit, max, current, subtext, icon: Icon }: SensorStatCardProps) {
  const percentage = max && current ? (current / max) * 100 : 0;
  const isWarning = percentage > 90;

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {max !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>0</span>
            <span>Limit: {max}</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${isWarning ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      )}
      {subtext && <p className="text-[10px] text-slate-400 mt-2">{subtext}</p>}
    </div>
  );
}
