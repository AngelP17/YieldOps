import { useState, useEffect, useMemo } from 'react';
import {
  Activity, Cpu, TrendingUp, Layers, Package, Shield, Zap,
  Play, AlertTriangle, ArrowRight, Clock, RefreshCw, Wrench
} from 'lucide-react';
import { KpiCard } from '../ui/KpiCard';
import { StatusBadge, JobStatusBadge } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';
import { api, DispatchQueueResponse, isApiConfigured } from '../../services/apiClient';
import { useAppConfig } from '../../App';
import type { Machine, ProductionJob } from '../../types';

interface OverviewTabProps {
  machines: Machine[];
  jobs: ProductionJob[];
}

// Mock dispatch data for demo mode
const MOCK_DISPATCH_QUEUE: DispatchQueueResponse = {
  pending_jobs: 3,
  available_machines: 2,
  queued_jobs: 5,
  next_dispatch: [
    { job_id: '3', job_name: 'WF-2024-0849', priority_level: 1, is_hot_lot: true },
    { job_id: '4', job_name: 'WF-2024-0850', priority_level: 3, is_hot_lot: false },
    { job_id: '5', job_name: 'WF-2024-0851', priority_level: 2, is_hot_lot: false },
  ]
};

const MOCK_DISPATCH_HISTORY = [
  { decision_id: '1', job_id: '1', production_jobs: { job_name: 'WF-2024-0847' }, machines: { name: 'Litho-A1' }, dispatched_at: new Date().toISOString() },
  { decision_id: '2', job_id: '2', production_jobs: { job_name: 'WF-2024-0848' }, machines: { name: 'Etch-C1' }, dispatched_at: new Date(Date.now() - 3600000).toISOString() },
];

export function OverviewTab({ machines, jobs }: OverviewTabProps) {
  const { toast } = useToast();
  const { isUsingMockData, updateMachine } = useAppConfig();
  const [dispatching, setDispatching] = useState(false);
  const [chaosLoading, setChaosLoading] = useState(false);
  const [dispatchQueue, setDispatchQueue] = useState<DispatchQueueResponse | null>(null);
  const [dispatchHistory, setDispatchHistory] = useState<Array<Record<string, any>>>([]);
  const apiAvailable = isApiConfigured();

  // Stats
  const stats = useMemo(() => {
    const total = machines.length;
    const running = machines.filter((m) => m.status === 'RUNNING').length;
    const idle = machines.filter((m) => m.status === 'IDLE').length;
    const down = machines.filter((m) => m.status === 'DOWN').length;
    const maintenance = machines.filter((m) => m.status === 'MAINTENANCE').length;
    const avgEfficiency = running > 0
      ? machines.filter(m => m.status === 'RUNNING').reduce((acc, m) => acc + m.efficiency_rating, 0) / running
      : machines.length > 0
        ? machines.reduce((acc, m) => acc + m.efficiency_rating, 0) / machines.length
        : 0;
    const totalWafers = machines.reduce((acc, m) => acc + m.current_wafer_count, 0);
    const totalProcessed = machines.reduce((acc, m) => acc + m.total_wafers_processed, 0);
    const pendingJobs = jobs.filter((j) => j.status === 'PENDING').length;
    const queuedJobs = jobs.filter((j) => j.status === 'QUEUED').length;
    const runningJobs = jobs.filter((j) => j.status === 'RUNNING').length;
    const hotLots = jobs.filter((j) => j.is_hot_lot && (j.status === 'PENDING' || j.status === 'QUEUED')).length;

    return { total, running, idle, down, maintenance, avgEfficiency, totalWafers, totalProcessed, pendingJobs, queuedJobs, runningJobs, hotLots };
  }, [machines, jobs]);

  // Fetch dispatch data
  useEffect(() => {
    if (!apiAvailable) {
      // Use mock data in demo mode
      setDispatchQueue(MOCK_DISPATCH_QUEUE);
      setDispatchHistory(MOCK_DISPATCH_HISTORY);
      return;
    }

    api.getDispatchQueue()
      .then(setDispatchQueue)
      .catch((err) => {
        console.error('Failed to fetch dispatch queue:', err);
        toast('Using offline data - API unavailable', 'info');
        setDispatchQueue(MOCK_DISPATCH_QUEUE);
      });
    
    api.getDispatchHistory(10)
      .then((data: any) => {
        setDispatchHistory(Array.isArray(data) ? data : data?.data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch dispatch history:', err);
        setDispatchHistory(MOCK_DISPATCH_HISTORY);
      });
  }, [apiAvailable, toast]);

  const handleRunDispatch = async () => {
    if (!apiAvailable) {
      toast('Dispatch simulation complete - 2 jobs assigned (Demo Mode)', 'success');
      return;
    }

    setDispatching(true);
    try {
      const result = await api.runDispatch({ max_dispatches: 10 });
      toast(`Dispatch complete: ${result.total_dispatched} jobs assigned`, 'success');
      // Refresh dispatch data
      api.getDispatchQueue().then(setDispatchQueue).catch(() => {});
      api.getDispatchHistory(10).then((data: any) => {
        setDispatchHistory(Array.isArray(data) ? data : data?.data || []);
      }).catch(() => {});
    } catch (err: any) {
      toast(err.message || 'Dispatch failed', 'error');
    } finally {
      setDispatching(false);
    }
  };

  const handleInjectChaos = async (type: 'machine_down' | 'sensor_spike' | 'efficiency_drop') => {
    setChaosLoading(true);
    
    // Pick a random running machine to affect
    const runningMachines = machines.filter(m => m.status === 'RUNNING');
    if (runningMachines.length === 0) {
      toast('No running machines available for chaos injection', 'warning');
      setChaosLoading(false);
      return;
    }
    
    const targetMachine = runningMachines[Math.floor(Math.random() * runningMachines.length)];
    
    if (!apiAvailable || isUsingMockData) {
      // Apply chaos directly to local state
      if (type === 'machine_down') {
        updateMachine(targetMachine.machine_id, { status: 'DOWN', efficiency_rating: 0 });
        toast(`Chaos injected: ${targetMachine.name} is now DOWN (Demo Mode)`, 'info');
      } else if (type === 'efficiency_drop') {
        const newEfficiency = Math.max(0.3, targetMachine.efficiency_rating - 0.3);
        updateMachine(targetMachine.machine_id, { efficiency_rating: newEfficiency });
        toast(`Chaos injected: ${targetMachine.name} efficiency dropped to ${(newEfficiency * 100).toFixed(0)}% (Demo Mode)`, 'info');
      } else if (type === 'sensor_spike') {
        toast(`Chaos injected: Sensor spike on ${targetMachine.name} (Demo Mode)`, 'info');
      }
      setChaosLoading(false);
      return;
    }

    try {
      const result: any = await api.injectChaos({ failure_type: type, machine_id: targetMachine.machine_id, severity: 'medium' });
      toast(`Chaos injected: ${result.scenario || type} on ${targetMachine.name}`, 'info');
    } catch (err: any) {
      toast(err.message || 'Chaos injection failed', 'error');
    } finally {
      setChaosLoading(false);
    }
  };

  const handleRecover = async (machineId: string, machineName: string) => {
    if (!apiAvailable || isUsingMockData) {
      updateMachine(machineId, { status: 'IDLE', efficiency_rating: 0.90 });
      toast(`${machineName} recovered to IDLE status (Demo Mode)`, 'success');
      return;
    }

    try {
      await api.recoverMachine(machineId);
      toast(`${machineName} recovered`, 'success');
    } catch (err: any) {
      toast(err.message || 'Recovery failed', 'error');
    }
  };

  const troubledMachines = machines.filter(m => m.status === 'DOWN' || m.status === 'MAINTENANCE');

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Machines" value={stats.total} subtext={`${stats.running} active`} icon={Cpu} trend="+2" color="blue" />
        <KpiCard label="Running" value={stats.running} subtext={`${stats.total > 0 ? ((stats.running / stats.total) * 100).toFixed(0) : 0}% uptime`} icon={Activity} trend="+5%" color="emerald" />
        <KpiCard label="Efficiency" value={`${(stats.avgEfficiency * 100).toFixed(1)}%`} subtext="Avg. performance" icon={TrendingUp} trend="+1.2%" color="indigo" />
        <KpiCard label="Wafers In Process" value={stats.totalWafers} subtext={`${stats.totalProcessed.toLocaleString()} total`} icon={Layers} trend="+12" color="amber" />
        <KpiCard label="Active Jobs" value={stats.runningJobs + stats.queuedJobs} subtext={`${stats.hotLots} hot lots`} icon={Package} trend="+3" color="purple" />
        <KpiCard label="Alerts" value={stats.down + stats.maintenance} subtext="Require attention" icon={Shield} trend="-1" color="rose" />
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunDispatch}
            disabled={dispatching}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {dispatching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run ToC Dispatch
          </button>

          <div className="relative group">
            <button
              disabled={chaosLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Inject Chaos
            </button>
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={() => handleInjectChaos('machine_down')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Machine Down</button>
              <button onClick={() => handleInjectChaos('sensor_spike')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Sensor Spike</button>
              <button onClick={() => handleInjectChaos('efficiency_drop')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Efficiency Drop</button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              {stats.pendingJobs} pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {stats.queuedJobs} queued
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {stats.runningJobs} running
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Dispatch Activity */}
        <div className="xl:col-span-2 space-y-6">
          {/* Dispatch Queue */}
          {dispatchQueue && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Dispatch Queue</h3>
                <p className="text-xs text-slate-500">{dispatchQueue.pending_jobs} pending jobs, {dispatchQueue.available_machines} available machines</p>
              </div>
              <div className="divide-y divide-slate-100">
                {dispatchQueue.next_dispatch?.map((job, i) => (
                  <div key={job.job_id || i} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400">#{i + 1}</span>
                      <span className="text-sm font-medium text-slate-900">{job.job_name}</span>
                      {job.is_hot_lot && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded">HOT</span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      P{job.priority_level}
                    </span>
                  </div>
                ))}
                {(!dispatchQueue.next_dispatch || dispatchQueue.next_dispatch.length === 0) && (
                  <div className="px-6 py-6 text-center text-sm text-slate-400">No pending jobs in queue</div>
                )}
              </div>
            </div>
          )}

          {/* Recent Dispatch Decisions */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Recent Dispatch Decisions</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {dispatchHistory.slice(0, 8).map((d: any, i) => (
                <div key={d.decision_id || i} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                    <div>
                      <span className="text-sm text-slate-700">{d.production_jobs?.job_name || d.job_id?.slice(0, 8)}</span>
                      <span className="text-xs text-slate-400 ml-2">{d.machines?.name || ''}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {d.dispatched_at ? new Date(d.dispatched_at).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
              {dispatchHistory.length === 0 && (
                <div className="px-6 py-6 text-center text-sm text-slate-400">No dispatch history yet. Run dispatch to assign jobs.</div>
              )}
            </div>
          </div>

          {/* Production Queue Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Production Queue</h3>
                <p className="text-xs text-slate-500">{jobs.length} jobs total</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {jobs.slice(0, 6).map((job) => (
                <div key={job.job_id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{job.job_name}</span>
                        {job.is_hot_lot && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded">HOT</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{job.customer_tag} &middot; {job.recipe_type}</p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{job.wafer_count} wafers</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />P{job.priority_level}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Machine Health */}
        <div className="space-y-6">
          {/* Machine Status Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Machine Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Running', count: stats.running, color: 'bg-emerald-500' },
                { label: 'Idle', count: stats.idle, color: 'bg-amber-500' },
                { label: 'Down', count: stats.down, color: 'bg-rose-500' },
                { label: 'Maintenance', count: stats.maintenance, color: 'bg-slate-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
            {stats.total > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  {stats.running > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(stats.running / stats.total) * 100}%` }} />}
                  {stats.idle > 0 && <div className="bg-amber-500 h-full" style={{ width: `${(stats.idle / stats.total) * 100}%` }} />}
                  {stats.down > 0 && <div className="bg-rose-500 h-full" style={{ width: `${(stats.down / stats.total) * 100}%` }} />}
                  {stats.maintenance > 0 && <div className="bg-slate-400 h-full" style={{ width: `${(stats.maintenance / stats.total) * 100}%` }} />}
                </div>
              </div>
            )}
          </div>

          {/* Troubled Machines */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-slate-900">Needs Attention</h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {troubledMachines.map((m) => (
                <div key={m.machine_id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{m.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRecover(m.machine_id, m.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Wrench className="w-3 h-3" />
                    Recover
                  </button>
                </div>
              ))}
              {troubledMachines.length === 0 && (
                <div className="px-6 py-6 text-center text-sm text-slate-400">All machines operational</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
