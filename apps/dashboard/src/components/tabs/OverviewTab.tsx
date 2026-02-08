import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IconActivity, IconCpu, IconTrendingUp, IconStack, IconPackage, IconShield, IconBolt,
  IconPlayerPlay, IconAlertTriangle, IconArrowRight, IconClock, IconRefresh, IconTool,
  IconChartBar, IconShieldCheck, IconShieldExclamation, IconGraph
} from '@tabler/icons-react';
import { KpiCard } from '../ui/KpiCard';
import { StatusBadge, JobStatusBadge } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';
import { SystemAnalyticsModal } from '../SystemAnalyticsModal';
import { SystemKnowledgeGraphViz } from '../overview/SystemKnowledgeGraphViz';
import { api, DispatchQueueResponse, isApiConfigured } from '../../services/apiClient';
import { useAppConfig } from '../../App';
import { useAegisSentinel } from '../../hooks/useAegisSentinel';
import type { Machine, ProductionJob, KnowledgeGraphData } from '../../types';

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

// ToC Dispatch Algorithm for Demo Mode
interface DispatchDecision {
  job_id: string;
  job_name: string;
  machine_id: string;
  machine_name: string;
  reason: string;
}

function runToCDispatch(
  pendingJobs: ProductionJob[],
  availableMachines: Machine[],
  maxDispatches: number = 5
): DispatchDecision[] {
  const decisions: DispatchDecision[] = [];

  // Sort jobs by ToC priority: hot lots first, then priority level, then FIFO
  const sortedJobs = [...pendingJobs].sort((a, b) => {
    if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
    if (a.priority_level !== b.priority_level) return a.priority_level - b.priority_level;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Track assigned machines
  const assignedMachines = new Set<string>();

  for (const job of sortedJobs) {
    if (decisions.length >= maxDispatches) break;

    // Find best available machine (IDLE status preferred, highest efficiency)
    const eligibleMachines = availableMachines.filter(m =>
      !assignedMachines.has(m.machine_id) &&
      m.status !== 'DOWN' &&
      m.status !== 'MAINTENANCE'
    );

    if (eligibleMachines.length === 0) continue;

    // Score machines: IDLE gets bonus, then by efficiency
    const scoredMachines = eligibleMachines.map(m => {
      let score = m.efficiency_rating;
      if (m.status === 'IDLE') score += 0.5;
      if (m.status === 'RUNNING') score += 0.2;
      return { machine: m, score };
    });

    scoredMachines.sort((a, b) => b.score - a.score);
    const bestMachine = scoredMachines[0].machine;

    decisions.push({
      job_id: job.job_id,
      job_name: job.job_name,
      machine_id: bestMachine.machine_id,
      machine_name: bestMachine.name,
      reason: `ToC Dispatch | Job: ${job.job_name} (P${job.priority_level})${job.is_hot_lot ? ' | HOT LOT' : ''} | Machine: ${bestMachine.name} | Efficiency: ${(bestMachine.efficiency_rating * 100).toFixed(0)}%`
    });

    assignedMachines.add(bestMachine.machine_id);
  }

  return decisions;
}


export function OverviewTab({ machines, jobs }: OverviewTabProps) {
  const { toast } = useToast();
  const { isUsingMockData, updateMachine, updateJob, recoverAllMachines } = useAppConfig();
  const [dispatching, setDispatching] = useState(false);
  const [chaosLoading, setChaosLoading] = useState(false);
  const [dispatchQueue, setDispatchQueue] = useState<DispatchQueueResponse | null>(null);
  interface DispatchHistoryItem {
    decision_id: string;
    job_id: string;
    production_jobs?: { job_name: string };
    machines?: { name: string };
    dispatched_at: string;
  }
  const [dispatchHistory, setDispatchHistory] = useState<DispatchHistoryItem[]>([]);
  const [, setLocalDecisions] = useState<DispatchDecision[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
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
    const hotLots = jobs.filter((j) => j.is_hot_lot && (j.status === 'PENDING' || j.status === 'QUEUED' || j.status === 'RUNNING')).length;

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
      .then((data: unknown) => {
        const historyData = Array.isArray(data) ? data : (data as { data?: DispatchHistoryItem[] })?.data || [];
        setDispatchHistory(historyData as DispatchHistoryItem[]);
      })
      .catch((err) => {
        console.error('Failed to fetch dispatch history:', err);
        setDispatchHistory(MOCK_DISPATCH_HISTORY);
      });
  }, [apiAvailable, toast]);

  const handleRunDispatch = async () => {
    setDispatching(true);

    try {
      if (!apiAvailable || isUsingMockData) {
        // Run ToC dispatch algorithm locally
        const pendingJobs = jobs.filter(j => j.status === 'PENDING');
        const availableMachines = machines.filter(m => m.status === 'IDLE' || m.status === 'RUNNING');

        if (pendingJobs.length === 0) {
          toast('No pending jobs to dispatch', 'warning');
          setDispatching(false);
          return;
        }

        if (availableMachines.length === 0) {
          toast('No available machines for dispatch', 'warning');
          setDispatching(false);
          return;
        }

        const decisions = runToCDispatch(pendingJobs, availableMachines, 5);

        // Apply decisions - update jobs and machines
        decisions.forEach(decision => {
          // Update job to QUEUED status and assign machine
          updateJob(decision.job_id, {
            status: 'QUEUED',
            assigned_machine_id: decision.machine_id
          });

          // Update machine status to RUNNING if it was IDLE
          const machine = machines.find(m => m.machine_id === decision.machine_id);
          if (machine && machine.status === 'IDLE') {
            updateMachine(decision.machine_id, { status: 'RUNNING' });
          }
        });

        // Add to local dispatch history
        const newDecisions = decisions.map((d, i) => ({
          decision_id: `local-${Date.now()}-${i}`,
          job_id: d.job_id,
          production_jobs: { job_name: d.job_name },
          machines: { name: d.machine_name },
          dispatched_at: new Date().toISOString()
        }));

        setLocalDecisions(prev => [...decisions, ...prev]);
        setDispatchHistory(prev => [...newDecisions, ...prev]);

        toast(`ToC Dispatch complete: ${decisions.length} jobs assigned (Demo Mode)`, 'success');
        setDispatching(false);
        return;
      }

      // API mode
      const result = await api.runDispatch({ max_dispatches: 10 });
      toast(`Dispatch complete: ${result.total_dispatched} jobs assigned`, 'success');
      // Refresh dispatch data
      api.getDispatchQueue().then(setDispatchQueue).catch(() => { });
      api.getDispatchHistory(10).then((data: unknown) => {
        const historyData = Array.isArray(data) ? data : (data as { data?: DispatchHistoryItem[] })?.data || [];
        setDispatchHistory(historyData as DispatchHistoryItem[]);
      }).catch(() => { });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Dispatch failed';
      toast(message, 'error');
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
      const result = await api.injectChaos({ failure_type: type, machine_id: targetMachine.machine_id, severity: 'medium' }) as { scenario?: string };
      toast(`Chaos injected: ${result.scenario || type} on ${targetMachine.name}`, 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Chaos injection failed';
      toast(message, 'error');
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Recovery failed';
      toast(message, 'error');
    }
  };

  const handleRecoverAll = async () => {
    const count = recoverAllMachines();
    if (count > 0) {
      toast(`${count} machines recovered to IDLE status`, 'success');
    } else {
      toast('No broken machines to recover', 'info');
    }
  };

  const troubledMachines = machines.filter(m => m.status === 'DOWN' || m.status === 'MAINTENANCE');
  const { summary: sentinelSummary } = useAegisSentinel({ pollingInterval: 15000 });

  // System Knowledge Graph state
  const [systemGraphData, setSystemGraphData] = useState<KnowledgeGraphData | null>(null);
  const [systemGraphLoading, setSystemGraphLoading] = useState(false);
  const [showSystemGraph, setShowSystemGraph] = useState(false);

  // Generate local system graph data (for demo mode)
  const generateLocalSystemGraph = useCallback((): KnowledgeGraphData => {
    const nodes: KnowledgeGraphData['nodes'] = [];
    const edges: KnowledgeGraphData['edges'] = [];
    const nodeIds = new Set<string>();

    const addNode = (id: string, label: string, type: string, color: string) => {
      if (!nodeIds.has(id)) {
        nodes.push({ data: { id, label, type, color } });
        nodeIds.add(id);
      }
    };

    const statusColors: Record<string, string> = {
      RUNNING: '#10B981',
      IDLE: '#F59E0B',
      DOWN: '#EF4444',
      MAINTENANCE: '#6B7280',
    };

    const typeColors: Record<string, string> = {
      lithography: '#8B5CF6',
      etching: '#EF4444',
      deposition: '#10B981',
      inspection: '#3B82F6',
      cleaning: '#06B6D4',
    };

    // Create active jobs lookup by machine
    const machineJobs = new Map<string, ProductionJob[]>();
    jobs.forEach(job => {
      if (job.assigned_machine_id) {
        if (!machineJobs.has(job.assigned_machine_id)) {
          machineJobs.set(job.assigned_machine_id, []);
        }
        machineJobs.get(job.assigned_machine_id)!.push(job);
      }
    });

    // Add machine nodes and relationships
    machines.forEach(machine => {
      const statusColor = statusColors[machine.status] || '#6B7280';
      const nodeType = `machine_${machine.status.toLowerCase()}`;

      addNode(machine.machine_id, machine.name, nodeType, statusColor);

      // Zone relationship
      const zoneNode = `ZONE-${machine.location_zone}`;
      addNode(zoneNode, `Zone ${machine.location_zone}`, 'zone', '#3B82F6');
      edges.push({
        data: { id: `${machine.machine_id}-${zoneNode}`, source: machine.machine_id, target: zoneNode, label: 'located_in', weight: 2 }
      });

      // Type relationship
      const typeNode = `TYPE-${machine.type.toUpperCase()}`;
      addNode(typeNode, machine.type, 'machine_type', typeColors[machine.type] || '#6B7280');
      edges.push({
        data: { id: `${machine.machine_id}-${typeNode}`, source: machine.machine_id, target: typeNode, label: 'is_type', weight: 1 }
      });

      // Job relationships
      const assignedJobs = machineJobs.get(machine.machine_id) || [];
      assignedJobs.forEach(job => {
        const jobNode = job.job_id;
        const jobColor = job.status === 'RUNNING' ? '#00F0FF' : job.status === 'QUEUED' ? '#F97316' : '#FBBF24';
        const jobType = job.status === 'RUNNING' ? 'job_running' : job.status === 'QUEUED' ? 'job_queued' : 'job_pending';
        const jobLabel = job.is_hot_lot ? `🔥 ${job.job_name}` : job.job_name;

        addNode(jobNode, jobLabel, jobType, jobColor);
        const weight = job.status === 'RUNNING' ? 3 : 2;
        edges.push({
          data: { id: `${machine.machine_id}-${jobNode}`, source: machine.machine_id, target: jobNode, label: job.status === 'RUNNING' ? 'processing' : 'assigned', weight }
        });
      });

      // Connect machines in same zone (weak connection)
      machines.forEach(other => {
        if (other.machine_id !== machine.machine_id && other.location_zone === machine.location_zone) {
          const edgeId = `${machine.machine_id}-${other.machine_id}`;
          if (!edges.some(e => e.data.id === edgeId || e.data.id === `${other.machine_id}-${machine.machine_id}`)) {
            edges.push({
              data: { id: edgeId, source: machine.machine_id, target: other.machine_id, label: 'same_zone', weight: 0.5 }
            });
          }
        }
      });
    });

    // Add system hub
    const hubId = 'SYSTEM-HUB';
    addNode(hubId, 'Fab System', 'system_hub', '#1E293B');

    // Summary nodes
    const runningCount = machines.filter(m => m.status === 'RUNNING').length;
    const downCount = machines.filter(m => m.status === 'DOWN').length;
    const activeJobs = jobs.filter(j => j.status === 'RUNNING').length;

    if (runningCount > 0) {
      const runningNode = 'SUMMARY-RUNNING';
      addNode(runningNode, `Running (${runningCount})`, 'summary', '#10B981');
      edges.push({ data: { id: `${hubId}-${runningNode}`, source: hubId, target: runningNode, label: 'has_running', weight: 1 } });
    }

    if (downCount > 0) {
      const downNode = 'SUMMARY-DOWN';
      addNode(downNode, `Down (${downCount})`, 'summary', '#EF4444');
      edges.push({ data: { id: `${hubId}-${downNode}`, source: hubId, target: downNode, label: 'has_down', weight: 2 } });
    }

    if (activeJobs > 0) {
      const jobsNode = 'SUMMARY-JOBS';
      addNode(jobsNode, `Active Jobs (${activeJobs})`, 'summary', '#00F0FF');
      edges.push({ data: { id: `${hubId}-${jobsNode}`, source: hubId, target: jobsNode, label: 'active_jobs', weight: 1 } });
    }

    // Calculate zone summary
    const zoneSummary: Record<string, { machine_count: number; running: number; utilization: number }> = {};
    machines.forEach(m => {
      if (!zoneSummary[m.location_zone]) {
        zoneSummary[m.location_zone] = { machine_count: 0, running: 0, utilization: 0 };
      }
      zoneSummary[m.location_zone].machine_count++;
      if (m.status === 'RUNNING') zoneSummary[m.location_zone].running++;
    });
    Object.keys(zoneSummary).forEach(zone => {
      const z = zoneSummary[zone];
      z.utilization = z.running / z.machine_count;
    });

    return {
      nodes,
      edges,
      stats: {
        node_count: nodes.length,
        edge_count: edges.length,
        central_concepts: [],
        zone_summary: zoneSummary,
        type_summary: {},
        bottlenecks: [],
      } as any
    };
  }, [machines, jobs]);

  // Fetch system graph data
  const fetchSystemGraph = useCallback(async () => {
    setSystemGraphLoading(true);
    try {
      if (!apiAvailable || isUsingMockData) {
        // Generate local graph
        const localData = generateLocalSystemGraph();
        setSystemGraphData(localData);
      } else {
        // Fetch from API
        const result = await api.getSystemGraph();
        setSystemGraphData(result);
      }
    } catch (err) {
      console.error('Failed to fetch system graph:', err);
      toast('Failed to load system topology graph', 'error');
    } finally {
      setSystemGraphLoading(false);
    }
  }, [apiAvailable, isUsingMockData, generateLocalSystemGraph, toast]);

  // Auto-generate graph when tab is opened
  useEffect(() => {
    if (showSystemGraph && !systemGraphData) {
      fetchSystemGraph();
    }
  }, [showSystemGraph, systemGraphData, fetchSystemGraph]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Machines" value={stats.total} subtext={`${stats.running} active`} icon={IconCpu} trend="+2" color="blue" />
        <KpiCard label="Running" value={stats.running} subtext={`${stats.total > 0 ? ((stats.running / stats.total) * 100).toFixed(0) : 0}% uptime`} icon={IconActivity} trend="+5%" color="emerald" />
        <KpiCard label="Efficiency" value={`${(stats.avgEfficiency * 100).toFixed(1)}%`} subtext="Avg. performance" icon={IconTrendingUp} trend="+1.2%" color="indigo" />
        <KpiCard label="Wafers In Process" value={stats.totalWafers} subtext={`${stats.totalProcessed.toLocaleString()} total`} icon={IconStack} trend="+12" color="amber" />
        <KpiCard label="Active Jobs" value={stats.runningJobs + stats.queuedJobs} subtext={`${stats.hotLots} hot lots`} icon={IconPackage} trend="+3" color="purple" />
        <KpiCard label="Alerts" value={stats.down + stats.maintenance} subtext="Require attention" icon={IconShield} trend="-1" color="rose" />
      </div>

      {/* Aegis Sentinel Summary */}
      {sentinelSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-emerald-50 rounded-lg">
              <IconShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{sentinelSummary.active_agents}</p>
              <p className="text-[10px] font-medium text-slate-500">Sentinel Agents</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-50 rounded-lg">
              <IconAlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{sentinelSummary.total_incidents_24h}</p>
              <p className="text-[10px] font-medium text-slate-500">Incidents (24h)</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-lg">
              <IconActivity className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{sentinelSummary.safety_circuit.green_actions_24h}</p>
              <p className="text-[10px] font-medium text-slate-500">Auto-Resolved</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-rose-50 rounded-lg">
              <IconShieldExclamation className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{sentinelSummary.safety_circuit.yellow_pending}</p>
              <p className="text-[10px] font-medium text-slate-500">Pending Approval</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleRunDispatch}
            disabled={dispatching}
            className="flex items-center gap-2 px-3 sm:px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {dispatching ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconPlayerPlay className="w-4 h-4" />}
            Run ToC Dispatch
          </button>

          <div className="relative group">
            <button
              disabled={chaosLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <IconBolt className="w-4 h-4" />
              Inject Chaos
            </button>
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={() => handleInjectChaos('machine_down')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Machine Down</button>
              <button onClick={() => handleInjectChaos('sensor_spike')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Sensor Spike</button>
              <button onClick={() => handleInjectChaos('efficiency_drop')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Efficiency Drop</button>
            </div>
          </div>

          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <IconChartBar className="w-4 h-4" />
            <span className="hidden sm:inline">System </span>Analytics
          </button>

          <div className="hidden sm:flex ml-auto items-center gap-4 text-sm text-slate-500">
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
                <p className="text-xs text-slate-500">{stats.pendingJobs} pending jobs, {machines.filter(m => m.status === 'IDLE').length} available machines</p>
              </div>
              <div className="divide-y divide-slate-100">
                {jobs
                  .filter(j => j.status === 'PENDING')
                  .sort((a, b) => {
                    if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
                    return a.priority_level - b.priority_level;
                  })
                  .slice(0, 5)
                  .map((job, i) => (
                    <div key={job.job_id} className="px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400">#{i + 1}</span>
                        <span className="text-sm font-medium text-slate-900">{job.job_name}</span>
                        {job.is_hot_lot && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded">HOT</span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <IconClock className="w-3 h-3" />
                        P{job.priority_level}
                      </span>
                    </div>
                  ))}
                {jobs.filter(j => j.status === 'PENDING').length === 0 && (
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
              {dispatchHistory.slice(0, 8).map((d, i) => (
                <div key={d.decision_id || i} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconArrowRight className="w-3.5 h-3.5 text-blue-500" />
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
                    <span className="flex items-center gap-1"><IconStack className="w-3 h-3" />{job.wafer_count} wafers</span>
                    <span className="flex items-center gap-1"><IconClock className="w-3 h-3" />P{job.priority_level}</span>
                    {job.assigned_machine_id && (
                      <span className="text-blue-600">{machines.find(m => m.machine_id === job.assigned_machine_id)?.name || 'Assigned'}</span>
                    )}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconAlertTriangle className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Needs Attention</h3>
                </div>
                {troubledMachines.length > 1 && (
                  <button
                    onClick={handleRecoverAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <IconTool className="w-3 h-3" />
                    Recover All ({troubledMachines.length})
                  </button>
                )}
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
                    <IconTool className="w-3 h-3" />
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

      {/* System Topology Knowledge Graph */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <IconGraph className="w-4 h-4 text-blue-600" />
              System Topology
            </h3>
            <p className="text-xs text-slate-500">
              Interactive visualization of machines, zones, jobs, and their relationships
            </p>
          </div>
          <button
            onClick={() => {
              if (!showSystemGraph) {
                setShowSystemGraph(true);
                fetchSystemGraph();
              } else {
                setShowSystemGraph(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <IconGraph className="w-4 h-4" />
            {showSystemGraph ? 'Hide Graph' : 'Show Graph'}
          </button>
        </div>

        {showSystemGraph && (
          systemGraphData ? (
            <SystemKnowledgeGraphViz
              data={systemGraphData}
              onGenerate={fetchSystemGraph}
              loading={systemGraphLoading}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <IconGraph className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-xs text-slate-500 mb-4">
                {systemGraphLoading ? 'Loading visualization...' : 'Click Show Graph to visualize system relationships'}
              </p>
              {systemGraphLoading && (
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              )}
            </div>
          )
        )}
      </div>

      {/* System Analytics Modal */}
      <SystemAnalyticsModal
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        machines={machines}
        jobs={jobs}
      />


    </div>
  );
}
