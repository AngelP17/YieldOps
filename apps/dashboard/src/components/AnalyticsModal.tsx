import { useMemo } from 'react';
import { Machine } from '../types';
import * as XLSX from 'xlsx';
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
  Minus,
  Download,
  Microscope,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { SPCControlChart } from './SPCControlChart';
import { SPCViolationBadges } from './SPCViolationBadges';
import { analyzeSPC } from '../lib/spcEngine';
import { useVirtualMetrology } from '../hooks/useVirtualMetrology';

interface AnalyticsModalProps {
  machine: Machine | null;
  isOpen: boolean;
  onClose: () => void;
  enableVM?: boolean;
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

export function AnalyticsModal({ machine, isOpen, onClose, enableVM = true }: AnalyticsModalProps) {
  // All hooks must be called before any early return
  const { status: vmStatus, history: vmHistory, isLoading: vmLoading } = useVirtualMetrology(
    machine?.machine_id ?? '',
    { enabled: enableVM && isOpen && !!machine, pollingInterval: 30000 }
  );

  const historyData = useMemo(() => generateMockHistory(), []);
  const jobHistory = useMemo(() => generateMockJobHistory(), []);

  // Calculate stats
  const avgEfficiency = historyData.reduce((acc, d) => acc + d.efficiency, 0) / historyData.length;
  const avgVibration = historyData.reduce((acc, d) => acc + d.vibration, 0) / historyData.length;
  const maxTemp = Math.max(...historyData.map(d => d.temperature));

  const completedJobs = jobHistory.filter(j => j.status === 'COMPLETED').length;
  const totalWafersProcessed = jobHistory.reduce((acc, j) => acc + j.wafers, 0);
  const avgJobDuration = jobHistory
    .filter(j => j.status === 'COMPLETED')
    .reduce((acc, j) => acc + j.duration, 0) / (completedJobs || 1);

  // Trend calculation (compare last 6 hours vs previous 6 hours)
  const recentEfficiency = historyData.slice(-6).reduce((acc, d) => acc + d.efficiency, 0) / 6;
  const previousEfficiency = historyData.slice(-12, -6).reduce((acc, d) => acc + d.efficiency, 0) / 6;
  const efficiencyTrend = recentEfficiency - previousEfficiency;

  // VM trend calculation
  const vmTrendData = useMemo(() => {
    if (!vmHistory?.history?.length) return null;
    
    const validPoints = vmHistory.history.filter(h => h.predicted_thickness_nm !== undefined);
    if (validPoints.length < 2) return null;
    
    const mid = Math.floor(validPoints.length / 2);
    const firstHalf = validPoints.slice(0, mid);
    const secondHalf = validPoints.slice(mid);
    
    const firstAvg = firstHalf.reduce((acc, h) => acc + (h.predicted_thickness_nm || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((acc, h) => acc + (h.predicted_thickness_nm || 0), 0) / secondHalf.length;
    
    return {
      firstAvg,
      secondAvg,
      change: secondAvg - firstAvg,
      percentChange: firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0,
      data: validPoints.map((h, i) => ({
        index: i,
        value: h.predicted_thickness_nm || 0,
        timestamp: h.recorded_at,
      })).reverse(),
    };
  }, [vmHistory]);

  if (!isOpen || !machine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-4xl h-full sm:h-auto max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${
              machine.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' :
              machine.status === 'IDLE' ? 'bg-amber-500' :
              machine.status === 'DOWN' ? 'bg-rose-500' :
              'bg-slate-400'
            }`} />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{machine.name}</h2>
              <p className="text-sm text-slate-500">{machine.type} • <span className="hidden sm:inline">{machine.machine_id}</span></p>
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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

          {/* Virtual Metrology Section */}
          {enableVM && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Microscope className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900">Virtual Metrology (VM)</h3>
                {vmLoading && <span className="text-xs text-slate-400">Loading...</span>}
              </div>
              
              {vmStatus?.has_prediction ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* VM Prediction Card */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Microscope className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-slate-500">Predicted Thickness</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900">
                        {vmStatus.predicted_thickness_nm?.toFixed(1)}
                      </span>
                      <span className="text-sm text-slate-500">nm</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {vmStatus.needs_correction ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          R2R Correction Needed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          On Target
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Confidence Score */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500">Confidence Score</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900">
                        {((vmStatus.confidence_score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            (vmStatus.confidence_score || 0) >= 0.9 ? 'bg-emerald-500' :
                            (vmStatus.confidence_score || 0) >= 0.7 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${(vmStatus.confidence_score || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* EWMA Error */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500">EWMA Error (R2R)</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-bold ${
                        Math.abs(vmStatus.ewma_error || 0) > 1.0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {(vmStatus.ewma_error || 0) > 0 ? '+' : ''}
                        {(vmStatus.ewma_error || 0).toFixed(2)}
                      </span>
                      <span className="text-sm text-slate-500">nm</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {Math.abs(vmStatus.ewma_error || 0) > 1.0 
                        ? 'Drift detected - correction applied' 
                        : 'Within tolerance'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                  <Microscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No VM predictions available for this machine</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {vmStatus?.message || 'Sensor data may be insufficient for prediction'}
                  </p>
                </div>
              )}

              {/* VM Trend Chart */}
              {vmTrendData && vmTrendData.data.length >= 2 && (
                <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Thickness Trend (24h)
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Trend:</span>
                      <span className={`text-xs font-medium ${
                        vmHistory?.trend === 'stable' ? 'text-emerald-600' :
                        vmHistory?.trend === 'improving' ? 'text-emerald-600' :
                        'text-amber-600'
                      }`}>
                        {vmHistory?.trend || 'stable'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Simple trend visualization */}
                  <div className="h-24 flex items-end gap-1">
                    {vmTrendData.data.slice(-24).map((point, i) => {
                      const maxVal = Math.max(...vmTrendData.data.map(d => d.value));
                      const minVal = Math.min(...vmTrendData.data.map(d => d.value));
                      const range = maxVal - minVal || 1;
                      const height = ((point.value - minVal) / range) * 100;
                      
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-t transition-colors relative group"
                          style={{ height: `${Math.max(10, height)}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded">
                              {point.value.toFixed(1)}nm
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                    <span>24h ago</span>
                    <span>Now</span>
                  </div>
                  
                  {/* Trend Stats */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <span className="text-xs text-slate-400">Avg Thickness</span>
                      <p className="text-sm font-semibold text-slate-700">
                        {vmHistory?.avg_thickness.toFixed(1)}nm
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Std Deviation</span>
                      <p className="text-sm font-semibold text-slate-700">
                        {vmHistory?.std_thickness.toFixed(2)}nm
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Change</span>
                      <p className={`text-sm font-semibold ${
                        vmTrendData.percentChange > 0 ? 'text-amber-600' : 
                        vmTrendData.percentChange < 0 ? 'text-emerald-600' : 'text-slate-700'
                      }`}>
                        {vmTrendData.percentChange > 0 ? '+' : ''}
                        {vmTrendData.percentChange.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPC Control Charts Section */}
          {(() => {
            const tempViolations = analyzeSPC(historyData.map(d => d.temperature)).violations;
            const vibViolations = analyzeSPC(historyData.map(d => d.vibration)).violations;
            const allViolations = [...tempViolations, ...vibViolations];
            return (
              <>
                <div className="mb-4">
                  <SPCViolationBadges violations={allViolations} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <SPCControlChart
                    data={historyData.map((d, i) => ({ index: i, value: d.temperature }))}
                    title="Temperature SPC (24h)"
                    unit="°"
                    height={200}
                  />
                  <SPCControlChart
                    data={historyData.map((d, i) => ({ index: i, value: d.vibration }))}
                    title="Vibration SPC (24h)"
                    unit=" mm/s"
                    height={200}
                  />
                </div>
              </>
            );
          })()}

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
            <ExportReportButton 
              machine={machine}
              historyData={historyData}
              jobHistory={jobHistory}
              avgEfficiency={avgEfficiency}
              avgVibration={avgVibration}
              maxTemp={maxTemp}
            />
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

// Export Report Button Component
interface ExportReportButtonProps {
  machine: Machine;
  historyData: Array<{ hour: number; efficiency: number; temperature: number; vibration: number }>;
  jobHistory: Array<{ id: string; name: string; wafers: number; duration: number; status: string; time: string }>;
  avgEfficiency: number;
  avgVibration: number;
  maxTemp: number;
}

function ExportReportButton({ machine, historyData, jobHistory, avgEfficiency, avgVibration, maxTemp }: ExportReportButtonProps) {
  const handleExport = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // 1. Machine Overview Sheet
    const overviewData = [
      ['Machine Analytics Report'],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Machine Information'],
      ['Machine ID', machine.machine_id],
      ['Name', machine.name],
      ['Type', machine.type],
      ['Status', machine.status],
      ['Location', machine.location_zone],
      [],
      ['Performance Metrics (24h)'],
      ['Average Efficiency', `${(avgEfficiency * 100).toFixed(1)}%`],
      ['Average Vibration', `${avgVibration.toFixed(2)} mm/s`],
      ['Max Temperature', `${maxTemp.toFixed(1)}°C`],
      ['Current Temperature', machine.temperature ? `${machine.temperature.toFixed(1)}°C` : 'N/A'],
      ['Current Vibration', machine.vibration ? machine.vibration.toFixed(2) : 'N/A'],
      ['Efficiency Rating', `${(machine.efficiency_rating * 100).toFixed(1)}%`],
      [],
      ['Wafer Statistics'],
      ['Current Wafer Count', machine.current_wafer_count],
      ['Total Wafers Processed', machine.total_wafers_processed.toLocaleString()],
      [],
      ['Maintenance'],
      ['Last Maintenance', machine.last_maintenance ? new Date(machine.last_maintenance).toLocaleDateString() : 'N/A'],
      ['Max Temperature Limit', machine.max_temperature],
      ['Max Vibration Limit', machine.max_vibration],
    ];
    const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, 'Machine Overview');
    
    // 2. Hourly History Sheet
    const historyHeaders = ['Hour', 'Efficiency (%)', 'Temperature (°C)', 'Vibration (mm/s)'];
    const historyRows = historyData.map(d => [
      d.hour,
      (d.efficiency * 100).toFixed(1),
      d.temperature.toFixed(1),
      d.vibration.toFixed(2)
    ]);
    const historyWs = XLSX.utils.aoa_to_sheet([historyHeaders, ...historyRows]);
    XLSX.utils.book_append_sheet(wb, historyWs, 'Hourly History');
    
    // 3. Job History Sheet
    const jobHeaders = ['Job ID', 'Name', 'Wafers', 'Duration (min)', 'Status', 'Time Ago'];
    const jobRows = jobHistory.map(j => [j.id, j.name, j.wafers, j.duration, j.status, j.time]);
    const jobWs = XLSX.utils.aoa_to_sheet([jobHeaders, ...jobRows]);
    XLSX.utils.book_append_sheet(wb, jobWs, 'Job History');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${machine.name}_Analytics_Report_${timestamp}.xlsx`;
    
    // Download the file
    XLSX.writeFile(wb, filename);
  };

  return (
    <button 
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
    >
      <Download className="w-4 h-4" />
      Export Report
    </button>
  );
}
