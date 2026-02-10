import { useState, useMemo, useEffect, useCallback } from 'react';
import { IconSearch, IconClock, IconStack, IconX, IconFlame, IconAlertTriangle, IconGraph, IconList, IconLayoutGrid } from '@tabler/icons-react';
import { JobStatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { api, CreateJobPayload, isApiConfigured } from '../../services/apiClient';
import { useAppConfig } from '../../App';
import { JobsKnowledgeGraphViz } from '../jobs/JobsKnowledgeGraphViz';
import { TrackShipmentButton, useIncomingDeepLink } from '../YieldOps_Integration';
import type { Machine, ProductionJob, JobStatus, KnowledgeGraphData } from '../../types';

interface JobsTabProps {
  jobs: ProductionJob[];
  machines: Machine[];
}

const RECIPE_TYPES = ['ADVANCED_LOGIC', '5NM_FINFE', 'STANDARD_LOGIC', 'MEMORY_DRAM', 'IO_CONTROLLER', 'POWER_MANAGEMENT', 'ANALOG_MIXER', 'TEST_CHIPS'];

export function JobsTab({ jobs, machines }: JobsTabProps) {
  const { toast } = useToast();
  const { isUsingMockData, addJob, updateJob } = useAppConfig();
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL');
  const [hotLotOnly, setHotLotOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'deadline'>('priority');
  const [showCreate, setShowCreate] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const apiAvailable = isApiConfigured();
  useIncomingDeepLink(setSearch);

  // Knowledge graph state
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [graphCustomers, setGraphCustomers] = useState<string[]>([]);
  const [graphFilter, setGraphFilter] = useState({ includeCompleted: true, customerFilter: '' });

  // Form state - defaults to hot lot since this is "Inject Hot Lot"
  const [form, setForm] = useState<CreateJobPayload>({
    job_name: '',
    wafer_count: 25,
    priority_level: 1,
    recipe_type: 'STANDARD_LOGIC',
    is_hot_lot: true,
    customer_tag: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const machineMap = useMemo(() => {
    const map: Record<string, string> = {};
    machines.forEach((m) => { map[m.machine_id] = m.name; });
    return map;
  }, [machines]);

  const filtered = useMemo(() => {
    let result = [...jobs];

    if (statusFilter !== 'ALL') result = result.filter((j) => j.status === statusFilter);
    if (hotLotOnly) result = result.filter((j) => j.is_hot_lot);
    if (search) {
      const query = search.toLowerCase();
      result = result.filter((j) => {
        const haystack = [
          j.job_id,
          j.job_name,
          j.customer_tag,
          j.recipe_type,
          j.status,
          j.assigned_machine_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'priority') {
        // 1. Hot lots first
        if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
        // 2. Then by priority level (1=highest, 5=lowest)
        if (a.priority_level !== b.priority_level) {
          return a.priority_level - b.priority_level;
        }
        // 3. Then by created_at (newest first) for consistent ordering
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'deadline') {
        // 1. Jobs with deadline come first (earliest deadline first)
        if (!a.deadline && !b.deadline) {
          // Both have no deadline - sort by priority then created
          if (a.priority_level !== b.priority_level) {
            return a.priority_level - b.priority_level;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        // 2. When deadlines are equal, sort by priority level
        const deadlineDiff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (deadlineDiff !== 0) return deadlineDiff;
        if (a.priority_level !== b.priority_level) {
          return a.priority_level - b.priority_level;
        }
        // 3. Then by created_at
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // sortBy === 'created'
      // 1. Newest first (descending by created_at)
      const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      // 2. Secondary sort by priority level
      if (a.priority_level !== b.priority_level) {
        return a.priority_level - b.priority_level;
      }
      // 3. Tertiary sort by hot lot status
      if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
      return 0;
    });

    return result;
  }, [jobs, statusFilter, hotLotOnly, search, sortBy]);

  // Job stats
  const jobStats = useMemo(() => ({
    total: jobs.length,
    pending: jobs.filter((j) => j.status === 'PENDING').length,
    queued: jobs.filter((j) => j.status === 'QUEUED').length,
    running: jobs.filter((j) => j.status === 'RUNNING').length,
    completed: jobs.filter((j) => j.status === 'COMPLETED').length,
    failed: jobs.filter((j) => j.status === 'FAILED').length,
    hotLots: jobs.filter((j) => j.is_hot_lot && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length,
  }), [jobs]);

  const handleCreateJob = async () => {
    if (!form.job_name || !form.recipe_type) {
      toast('Please fill in required fields', 'error');
      return;
    }

    if (!apiAvailable || isUsingMockData) {
      // Create job locally
      const newJob: ProductionJob = {
        job_id: `job-${Date.now()}`,
        job_name: form.job_name,
        wafer_count: form.wafer_count,
        priority_level: form.priority_level as 1 | 2 | 3 | 4 | 5,
        status: 'PENDING',
        recipe_type: form.recipe_type,
        is_hot_lot: form.is_hot_lot,
        customer_tag: form.customer_tag,
        assigned_machine_id: undefined,
        estimated_duration_minutes: form.estimated_duration_minutes,
        deadline: form.deadline,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addJob(newJob);
      toast(`Hot lot "${form.job_name}" injected (Demo Mode)`, 'success');
      setShowCreate(false);
      setForm({
        job_name: '',
        wafer_count: 25,
        priority_level: 3,
        recipe_type: 'STANDARD_LOGIC',
        is_hot_lot: false,
        customer_tag: '',
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.createJob(form);
      toast(`Hot lot "${form.job_name}" injected`, 'success');
      setShowCreate(false);
      setForm({
        job_name: '',
        wafer_count: 25,
        priority_level: 3,
        recipe_type: 'STANDARD_LOGIC',
        is_hot_lot: false,
        customer_tag: '',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create job';
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string, jobName: string) => {
    if (!apiAvailable || isUsingMockData) {
      updateJob(jobId, { status: 'CANCELLED' });
      toast(`Job "${jobName}" cancelled (Demo Mode)`, 'success');
      return;
    }

    setCancellingId(jobId);
    try {
      await api.cancelJob(jobId);
      toast(`Job "${jobName}" cancelled`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel job';
      toast(message, 'error');
    } finally {
      setCancellingId(null);
    }
  };

  // Generate local graph data from jobs and machines (for demo mode)
  const generateLocalGraphData = useCallback((): KnowledgeGraphData => {
    const nodes: KnowledgeGraphData['nodes'] = [];
    const edges: KnowledgeGraphData['edges'] = [];
    const nodeIds = new Set<string>();

    const addNode = (id: string, label: string, type: string, color: string) => {
      if (!nodeIds.has(id)) {
        nodes.push({ data: { id, label, type, color } });
        nodeIds.add(id);
      }
    };

    // Filter jobs based on current filter
    let filteredJobs = jobs;
    if (!graphFilter.includeCompleted) {
      filteredJobs = jobs.filter(j => j.status !== 'COMPLETED');
    }
    if (graphFilter.customerFilter) {
      filteredJobs = jobs.filter(j => j.customer_tag?.toUpperCase() === graphFilter.customerFilter.toUpperCase());
    }

    filteredJobs.forEach(job => {
      // Job node
      const isHot = job.is_hot_lot;
      addNode(
        job.job_id,
        job.job_name,
        isHot ? 'job_hot' : 'job',
        isHot ? '#F43F5E' : '#3B82F6'
      );

      // Status node
      const statusNode = `STATUS-${job.status}`;
      const statusColors: Record<string, string> = {
        PENDING: '#F59E0B',
        QUEUED: '#3B82F6',
        RUNNING: '#10B981',
        COMPLETED: '#6B7280',
        FAILED: '#EF4444',
        CANCELLED: '#9CA3AF',
      };
      addNode(statusNode, job.status, 'status', statusColors[job.status] || '#6B7280');
      edges.push({
        data: { id: `${job.job_id}-${statusNode}`, source: job.job_id, target: statusNode, label: 'has_status', weight: 1 }
      });

      // Priority node
      const priorityNode = `PRIORITY-P${job.priority_level}`;
      const priorityColors = { 1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#3B82F6', 5: '#6B7280' };
      addNode(priorityNode, `P${job.priority_level}`, 'priority', priorityColors[job.priority_level as keyof typeof priorityColors] || '#6B7280');
      edges.push({
        data: { id: `${job.job_id}-${priorityNode}`, source: job.job_id, target: priorityNode, label: 'has_priority', weight: 1 }
      });

      // Customer node
      if (job.customer_tag) {
        const custNode = `CUST-${job.customer_tag.toUpperCase()}`;
        addNode(custNode, job.customer_tag, 'customer', '#8B5CF6');
        edges.push({
          data: { id: `${job.job_id}-${custNode}`, source: job.job_id, target: custNode, label: 'for_customer', weight: 2 }
        });
      }

      // Recipe node
      if (job.recipe_type) {
        const recipeNode = `RECIPE-${job.recipe_type}`;
        addNode(recipeNode, job.recipe_type.replace(/_/g, ' '), 'recipe', '#10B981');
        edges.push({
          data: { id: `${job.job_id}-${recipeNode}`, source: job.job_id, target: recipeNode, label: 'uses_recipe', weight: 1 }
        });
      }

      // Machine assignment
      if (job.assigned_machine_id) {
        const machine = machines.find(m => m.machine_id === job.assigned_machine_id);
        if (machine) {
          addNode(machine.machine_id, machine.name, 'machine', '#00F0FF');
          const weight = job.status === 'RUNNING' ? 3 : job.status === 'QUEUED' ? 2 : 1;
          edges.push({
            data: { id: `${job.job_id}-${machine.machine_id}`, source: job.job_id, target: machine.machine_id, label: 'assigned_to', weight }
          });

          // Zone node
          const zoneNode = `ZONE-${machine.location_zone}`;
          addNode(zoneNode, `Zone ${machine.location_zone}`, 'zone', '#6B7280');
          edges.push({
            data: { id: `${machine.machine_id}-${zoneNode}`, source: machine.machine_id, target: zoneNode, label: 'located_in', weight: 1 }
          });
        }
      }
    });

    // Calculate stats
    const jobNodes = nodes.filter(n => n.data.type === 'job' || n.data.type === 'job_hot');
    const customerNodes = nodes.filter(n => n.data.type === 'customer');
    
    const customerWorkload: Record<string, number> = {};
    customerNodes.forEach(cust => {
      const count = edges.filter(e => e.data.target === cust.data.id || e.data.source === cust.data.id).length;
      customerWorkload[cust.data.label] = count;
    });

    const jobClusters: Record<string, string[]> = {};
    jobNodes.forEach(job => {
      const jobStatus = edges.find(e => e.data.source === job.data.id && e.data.label === 'has_status')?.data.target || 'Unknown';
      const statusLabel = jobStatus.replace('STATUS-', '');
      if (!jobClusters[statusLabel]) jobClusters[statusLabel] = [];
      jobClusters[statusLabel].push(job.data.id);
    });

    return {
      nodes,
      edges,
      stats: {
        node_count: nodes.length,
        edge_count: edges.length,
        central_concepts: [],
        customer_workload: customerWorkload,
        job_clusters: jobClusters,
      } as any
    };
  }, [jobs, machines, graphFilter]);

  // Fetch knowledge graph data
  const fetchGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      if (!apiAvailable || isUsingMockData) {
        // Generate local graph
        const localData = generateLocalGraphData();
        setGraphData(localData);
        
        // Extract unique customers
        const customers = [...new Set(jobs.map(j => j.customer_tag).filter(Boolean))] as string[];
        setGraphCustomers(customers);
      } else {
        // Fetch from API
        const [graphResult, customersResult] = await Promise.all([
          api.getJobsGraph({
            include_completed: graphFilter.includeCompleted,
            customer_filter: graphFilter.customerFilter,
          }),
          api.getJobsCustomers(),
        ]);
        setGraphData(graphResult);
        setGraphCustomers(customersResult);
      }
    } catch (err) {
      console.error('Failed to fetch jobs graph:', err);
      toast('Failed to load knowledge graph', 'error');
    } finally {
      setGraphLoading(false);
    }
  }, [apiAvailable, isUsingMockData, graphFilter, generateLocalGraphData, jobs, toast]);

  // Auto-generate graph when shown, and regenerate on filter changes
  useEffect(() => {
    if (showGraph) {
      fetchGraphData();
    }
  }, [showGraph, fetchGraphData]); // Initial show triggers fetch

  // Regenerate when filters change
  useEffect(() => {
    if (showGraph) {
      fetchGraphData();
    }
  }, [graphFilter, showGraph, fetchGraphData]);

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isUsingMockData && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <IconAlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800">Demo Mode Active</p>
            <p className="text-xs text-amber-700">Jobs will be stored locally. Configure VITE_API_URL to enable persistent storage.</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: jobStats.total, color: 'text-slate-900' },
          { label: 'Pending', value: jobStats.pending, color: 'text-yellow-600' },
          { label: 'Queued', value: jobStats.queued, color: 'text-blue-600' },
          { label: 'Running', value: jobStats.running, color: 'text-emerald-600' },
          { label: 'Completed', value: jobStats.completed, color: 'text-slate-500' },
          { label: 'Failed', value: jobStats.failed, color: 'text-rose-600' },
          { label: 'Hot Lots', value: jobStats.hotLots, color: 'text-rose-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 transition-colors"
          >
            <IconFlame className="w-4 h-4" />
            Inject Hot Lot
          </button>

          <div className="relative flex-1 min-w-0 order-first basis-full sm:basis-auto sm:order-none">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search jobs or customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'ALL')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'created' | 'deadline')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Created</option>
            <option value="deadline">Sort: Deadline</option>
          </select>

          <button
            onClick={() => setHotLotOnly(!hotLotOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              hotLotOnly
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <IconFlame className="w-3.5 h-3.5" />
            Hot Lots
          </button>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 ml-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <IconList className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <IconLayoutGrid className="w-4 h-4" />
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* Job List/Grid View */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((job) => (
              <div key={job.job_id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900">{job.job_name}</span>
                      {job.is_hot_lot && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded">HOT LOT</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        job.priority_level <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        P{job.priority_level}
                      </span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{job.customer_tag || 'No customer'}</span>
                      <span>&middot;</span>
                      <span>{job.recipe_type}</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1"><IconStack className="w-3 h-3" />{job.wafer_count} wafers</span>
                      {job.assigned_machine_id && (
                        <>
                          <span>&middot;</span>
                          <span className="text-blue-600">{machineMap[job.assigned_machine_id] || 'Assigned'}</span>
                        </>
                      )}
                      {job.deadline && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1"><IconClock className="w-3 h-3" />{new Date(job.deadline).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-2 sm:ml-4 shrink-0">
                    <TrackShipmentButton
                      jobId={job.job_id}
                      query={job.customer_tag || job.job_name}
                      status={job.status}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    />
                    {(job.status === 'PENDING' || job.status === 'QUEUED') && (
                      <button
                        onClick={() => handleCancelJob(job.job_id, job.job_name)}
                        disabled={cancellingId === job.job_id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors"
                      >
                        <IconX className="w-3 h-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-slate-400">No jobs match your filters</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((job) => (
            <div key={job.job_id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 truncate">{job.job_name}</h4>
                  <p className="text-xs text-slate-500">{job.customer_tag || 'No customer'}</p>
                </div>
                {job.is_hot_lot && (
                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded shrink-0 ml-2">HOT</span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <JobStatusBadge status={job.status} />
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  job.priority_level <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  P{job.priority_level}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-900">{job.wafer_count}</p>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Wafers</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-900 truncate">{job.recipe_type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Recipe</p>
                </div>
              </div>

              {job.assigned_machine_id && (
                <p className="text-xs text-blue-600 mb-2">{machineMap[job.assigned_machine_id] || 'Assigned'}</p>
              )}

              {job.deadline && (
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                  <IconClock className="w-3 h-3" />
                  Due: {new Date(job.deadline).toLocaleDateString()}
                </p>
              )}

              {(job.status === 'PENDING' || job.status === 'QUEUED') && (
                <button
                  onClick={() => handleCancelJob(job.job_id, job.job_name)}
                  disabled={cancellingId === job.job_id}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors"
                >
                  <IconX className="w-3 h-3" />
                  Cancel Job
                </button>
              )}
              <TrackShipmentButton
                jobId={job.job_id}
                query={job.customer_tag || job.job_name}
                status={job.status}
              />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full bg-slate-100 rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-sm text-slate-500">No jobs match your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Create Job Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Inject Hot Lot">
        <div className="space-y-4">
          {isUsingMockData && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg">
              <IconAlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-700">Demo Mode - Job will be stored locally only</span>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Job Name *</label>
            <input
              type="text"
              value={form.job_name}
              onChange={(e) => setForm({ ...form, job_name: e.target.value })}
              placeholder="e.g. WF-2026-0001"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Wafer Count *</label>
              <input
                type="number"
                min="1"
                value={form.wafer_count}
                onChange={(e) => setForm({ ...form, wafer_count: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Priority (1=Highest)</label>
              <select
                value={form.priority_level}
                onChange={(e) => setForm({ ...form, priority_level: parseInt(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="1">P1 - Critical</option>
                <option value="2">P2 - High</option>
                <option value="3">P3 - Medium</option>
                <option value="4">P4 - Standard</option>
                <option value="5">P5 - Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Recipe Type *</label>
            <select
              value={form.recipe_type}
              onChange={(e) => setForm({ ...form, recipe_type: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {RECIPE_TYPES.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Customer</label>
            <input
              type="text"
              value={form.customer_tag}
              onChange={(e) => setForm({ ...form, customer_tag: e.target.value })}
              placeholder="e.g. APPLE, NVIDIA"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_hot_lot}
                onChange={(e) => setForm({ ...form, is_hot_lot: e.target.checked, priority_level: e.target.checked ? 1 : form.priority_level })}
                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-sm font-medium text-slate-700">Hot Lot</span>
            </label>
            <span className="text-xs text-slate-400">VIP priority - bypasses normal queue</span>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateJob}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Injecting...' : 'Inject Hot Lot'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Knowledge Graph Section */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <IconGraph className="w-4 h-4 text-blue-600" />
              Job Relationships
            </h3>
            <p className="text-xs text-slate-500">
              Visualize connections between jobs, machines, customers, and recipes
            </p>
          </div>
          <button
            onClick={() => {
              if (!showGraph) {
                setShowGraph(true);
                fetchGraphData();
              } else {
                setShowGraph(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <IconGraph className="w-4 h-4" />
            {showGraph ? 'Hide Graph' : 'Show Graph'}
          </button>
        </div>

        {showGraph && (
          graphData ? (
            <JobsKnowledgeGraphViz
              data={graphData}
              onGenerate={fetchGraphData}
              onFilterChange={setGraphFilter}
              loading={graphLoading}
              customers={graphCustomers}
              currentFilter={graphFilter}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <IconGraph className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Knowledge Graph</h4>
              <p className="text-xs text-slate-500 mb-4">
                {graphLoading ? 'Loading graph...' : 'Click refresh to generate the jobs knowledge graph'}
              </p>
              {graphLoading && (
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
