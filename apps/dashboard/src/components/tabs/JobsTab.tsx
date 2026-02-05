import { useState, useMemo } from 'react';
import { Plus, Search, Clock, Layers, X, Flame, AlertTriangle, MoreHorizontal, Play, CheckCircle, RotateCcw } from 'lucide-react';
import { JobStatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { api, CreateJobPayload, isApiConfigured } from '../../services/apiClient';
import { useAppConfig } from '../../App';
import type { Machine, ProductionJob, JobStatus } from '../../types';

interface JobsTabProps {
  jobs: ProductionJob[];
  machines: Machine[];
  isRealTime?: boolean;
  pendingCount?: number;
  hotLotCount?: number;
}

const RECIPE_TYPES = ['ADVANCED_LOGIC', '5NM_FINFE', 'STANDARD_LOGIC', 'MEMORY_DRAM', 'IO_CONTROLLER', 'POWER_MANAGEMENT', 'ANALOG_MIXER', 'TEST_CHIPS'];

export function JobsTab({ jobs, machines, isRealTime, pendingCount, hotLotCount }: JobsTabProps) {
  const { toast } = useToast();
  const { isUsingMockData, addJob, updateJob } = useAppConfig();
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL');
  const [hotLotOnly, setHotLotOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'deadline'>('priority');
  const [showCreate, setShowCreate] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const apiAvailable = isApiConfigured();

  // Form state
  const [form, setForm] = useState<CreateJobPayload>({
    job_name: '',
    wafer_count: 25,
    priority_level: 3,
    recipe_type: 'STANDARD_LOGIC',
    is_hot_lot: false,
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
    if (search) result = result.filter((j) =>
      j.job_name.toLowerCase().includes(search.toLowerCase()) ||
      (j.customer_tag || '').toLowerCase().includes(search.toLowerCase())
    );

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

  // Job stats - use real-time counts when available
  const jobStats = useMemo(() => ({
    total: jobs.length,
    pending: pendingCount ?? jobs.filter((j) => j.status === 'PENDING').length,
    queued: jobs.filter((j) => j.status === 'QUEUED').length,
    running: jobs.filter((j) => j.status === 'RUNNING').length,
    completed: jobs.filter((j) => j.status === 'COMPLETED').length,
    failed: jobs.filter((j) => j.status === 'FAILED').length,
    hotLots: hotLotCount ?? jobs.filter((j) => j.is_hot_lot && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length,
  }), [jobs, pendingCount, hotLotCount]);

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
      toast(`Job "${form.job_name}" created (Demo Mode)`, 'success');
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
      toast(`Job "${form.job_name}" created`, 'success');
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

  // Get available actions based on job status
  const getAvailableActions = (status: JobStatus) => {
    switch (status) {
      case 'PENDING':
        return [
          { value: 'QUEUED', label: 'Queue', icon: Layers },
          { value: 'CANCELLED', label: 'Cancel', icon: X },
        ];
      case 'QUEUED':
        return [
          { value: 'RUNNING', label: 'Start', icon: Play },
          { value: 'CANCELLED', label: 'Cancel', icon: X },
        ];
      case 'RUNNING':
        return [
          { value: 'COMPLETED', label: 'Complete', icon: CheckCircle },
          { value: 'FAILED', label: 'Fail', icon: AlertTriangle },
          { value: 'CANCELLED', label: 'Cancel', icon: X },
        ];
      case 'FAILED':
        return [
          { value: 'QUEUED', label: 'Retry', icon: RotateCcw },
        ];
      case 'CANCELLED':
        return [
          { value: 'QUEUED', label: 'Retry', icon: RotateCcw },
        ];
      default:
        return [];
    }
  };

  const handleJobAction = async (job: ProductionJob, newStatus: JobStatus) => {
    setActionMenuOpen(null);
    
    // Build updates object
    const updates: { status: JobStatus; actual_start_time?: string } = { status: newStatus };
    
    // Add timestamps based on status transition
    if (newStatus === 'RUNNING') {
      updates.actual_start_time = new Date().toISOString();
    }
    
    if (!apiAvailable || isUsingMockData) {
      updateJob(job.job_id, updates);
      const actionLabel = newStatus === 'CANCELLED' ? 'cancelled' : 
                         newStatus === 'FAILED' ? 'marked as failed' :
                         newStatus === 'COMPLETED' ? 'completed' :
                         newStatus === 'QUEUED' ? 'queued' :
                         newStatus === 'RUNNING' ? 'started' : 'updated';
      toast(`Job "${job.job_name}" ${actionLabel} (Demo Mode)`, 'success');
      return;
    }

    try {
      await api.updateJob(job.job_id, { status: newStatus });
      const actionLabel = newStatus === 'CANCELLED' ? 'cancelled' : 
                         newStatus === 'FAILED' ? 'marked as failed' :
                         newStatus === 'COMPLETED' ? 'completed' :
                         newStatus === 'QUEUED' ? 'queued' :
                         newStatus === 'RUNNING' ? 'started' : 'updated';
      toast(`Job "${job.job_name}" ${actionLabel}`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update job';
      toast(message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isUsingMockData && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800">Demo Mode Active</p>
            <p className="text-xs text-amber-700">Jobs will be stored locally. Configure VITE_API_URL to enable persistent storage.</p>
          </div>
        </div>
      )}

      {/* Real-time Indicator */}
      {isRealTime && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg w-fit">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium">Real-time updates active</span>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: jobStats.total, color: 'text-slate-900' },
          { label: pendingCount !== undefined ? 'Pending' : 'Pending', value: jobStats.pending, color: 'text-yellow-600' },
          { label: 'Queued', value: jobStats.queued, color: 'text-blue-600' },
          { label: 'Running', value: jobStats.running, color: 'text-emerald-600' },
          { label: 'Completed', value: jobStats.completed, color: 'text-slate-500' },
          { label: 'Failed', value: jobStats.failed, color: 'text-rose-600' },
          { label: hotLotCount !== undefined ? 'Hot Lots 🔥' : 'Hot Lots', value: jobStats.hotLots, color: 'text-rose-600' },
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
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Job
          </button>

          <div className="relative flex-1 min-w-0 order-first basis-full sm:basis-auto sm:order-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
            <Flame className="w-3.5 h-3.5" />
            Hot Lots
          </button>
        </div>
      </div>

      {/* Job List */}
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
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{job.wafer_count} wafers</span>
                    {job.assigned_machine_id && (
                      <>
                        <span>&middot;</span>
                        <span className="text-blue-600">{machineMap[job.assigned_machine_id] || 'Assigned'}</span>
                      </>
                    )}
                    {job.deadline && (
                      <>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(job.deadline).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-2 sm:ml-4 shrink-0 relative">
                  {(() => {
                    const actions = getAvailableActions(job.status);
                    if (actions.length === 0) return null;
                    
                    return (
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === job.job_id ? null : job.job_id)}
                          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Job actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="hidden sm:inline">Actions</span>
                        </button>
                        
                        {actionMenuOpen === job.job_id && (
                          <>
                            {/* Backdrop to close menu */}
                            <div 
                              className="fixed inset-0 z-40"
                              onClick={() => setActionMenuOpen(null)}
                            />
                            {/* Dropdown menu */}
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                              {actions.map((action) => {
                                const ActionIcon = action.icon;
                                const colorClass = action.value === 'CANCELLED' || action.value === 'FAILED'
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : action.value === 'COMPLETED'
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-700 hover:bg-slate-50';
                                
                                return (
                                  <button
                                    key={action.value}
                                    onClick={() => handleJobAction(job, action.value as JobStatus)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left ${colorClass} transition-colors`}
                                  >
                                    <ActionIcon className="w-3.5 h-3.5" />
                                    {action.label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-slate-400">No jobs match your filters</div>
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Production Job">
        <div className="space-y-4">
          {isUsingMockData && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
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
              {submitting ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
