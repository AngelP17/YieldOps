import { useState, useMemo } from 'react';
import { IconSearch, IconTool, IconBolt, IconActivity, IconTrendingUp, IconStack, IconAlertTriangle, IconChartBar } from '@tabler/icons-react';
import { MachineNode } from '../MachineNode';
import { StatusBadge } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';
import { AnalyticsModal } from '../AnalyticsModal';
import { api, isApiConfigured } from '../../services/apiClient';
import { useAppConfig } from '../../App';
import { useVirtualMetrologyBatch } from '../../hooks/useVirtualMetrology';
import type { Machine, MachineStatus, MachineType } from '../../types';

interface MachinesTabProps {
  machines: Machine[];
}

export function MachinesTab({ machines }: MachinesTabProps) {
  const { toast } = useToast();
  const { isUsingMockData, updateMachine } = useAppConfig();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<MachineType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'efficiency' | 'type'>('name');
  const apiAvailable = isApiConfigured();

  // VM polling for all machines
  const { statuses: vmStatuses } = useVirtualMetrologyBatch(
    machines.map(m => m.machine_id),
    { pollingInterval: 30000, enabled: true }
  );

  const filtered = useMemo(() => {
    const result = machines.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && m.type !== typeFilter) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status': {
          // Order: RUNNING > IDLE > MAINTENANCE > DOWN
          const statusOrder = { RUNNING: 0, IDLE: 1, MAINTENANCE: 2, DOWN: 3 };
          const orderDiff = statusOrder[a.status] - statusOrder[b.status];
          if (orderDiff !== 0) return orderDiff;
          // Secondary sort by name
          return a.name.localeCompare(b.name);
        }
        case 'efficiency': {
          // Higher efficiency first
          const effDiff = b.efficiency_rating - a.efficiency_rating;
          if (effDiff !== 0) return effDiff;
          // Secondary sort by name
          return a.name.localeCompare(b.name);
        }
        case 'type':
          return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [machines, statusFilter, typeFilter, search, sortBy]);

  const handleStatusChange = async (machineId: string, status: MachineStatus) => {
    if (!apiAvailable || isUsingMockData) {
      updateMachine(machineId, { status });
      toast(`Machine status updated to ${status} (Demo Mode)`, 'success');
      if (selectedMachine?.machine_id === machineId) {
        setSelectedMachine({ ...selectedMachine, status });
      }
      return;
    }

    setActionLoading('status');
    try {
      await api.updateMachine(machineId, { status });
      toast(`Machine status updated to ${status}`, 'success');
      if (selectedMachine?.machine_id === machineId) {
        setSelectedMachine({ ...selectedMachine, status });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      toast(message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleRecover = async (machineId: string, name: string) => {
    if (!apiAvailable || isUsingMockData) {
      updateMachine(machineId, { status: 'IDLE', efficiency_rating: 0.90 });
      toast(`${name} recovered to IDLE (Demo Mode)`, 'success');
      if (selectedMachine?.machine_id === machineId) {
        setSelectedMachine({ ...selectedMachine, status: 'IDLE', efficiency_rating: 0.90 });
      }
      return;
    }

    setActionLoading('recover');
    try {
      await api.recoverMachine(machineId);
      toast(`${name} recovered`, 'success');
      if (selectedMachine?.machine_id === machineId) {
        setSelectedMachine({ ...selectedMachine, status: 'IDLE' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Recovery failed';
      toast(message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleChaos = async (machineId: string, type: 'machine_down' | 'sensor_spike' | 'efficiency_drop') => {
    const machine = machines.find(m => m.machine_id === machineId);
    if (!machine) return;

    if (!apiAvailable || isUsingMockData) {
      if (type === 'machine_down') {
        updateMachine(machineId, { status: 'DOWN', efficiency_rating: 0 });
        toast(`Chaos: ${machine.name} is now DOWN (Demo Mode)`, 'info');
        if (selectedMachine?.machine_id === machineId) {
          setSelectedMachine({ ...selectedMachine, status: 'DOWN', efficiency_rating: 0 });
        }
      } else if (type === 'efficiency_drop') {
        const newEfficiency = Math.max(0.3, machine.efficiency_rating - 0.3);
        updateMachine(machineId, { efficiency_rating: newEfficiency });
        toast(`Chaos: ${machine.name} efficiency dropped to ${(newEfficiency * 100).toFixed(0)}% (Demo Mode)`, 'info');
        if (selectedMachine?.machine_id === machineId) {
          setSelectedMachine({ ...selectedMachine, efficiency_rating: newEfficiency });
        }
      } else if (type === 'sensor_spike') {
        toast(`Chaos: Sensor spike on ${machine.name} (Demo Mode)`, 'info');
      }
      return;
    }

    setActionLoading('chaos');
    try {
      const result = await api.injectChaos({ failure_type: type, machine_id: machineId, severity: 'medium' }) as { scenario?: string };
      toast(`Chaos injected: ${result.scenario || type}`, 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Chaos injection failed';
      toast(message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search machines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MachineStatus | 'ALL')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="RUNNING">Running</option>
            <option value="IDLE">Idle</option>
            <option value="DOWN">Down</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MachineType | 'ALL')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Types</option>
            <option value="lithography">Lithography</option>
            <option value="etching">Etching</option>
            <option value="deposition">Deposition</option>
            <option value="inspection">Inspection</option>
            <option value="cleaning">Cleaning</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'status' | 'efficiency' | 'type')}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="efficiency">Sort: Efficiency</option>
            <option value="type">Sort: Type</option>
          </select>

          <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} machines</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Machine Grid */}
        <div className="xl:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((machine) => (
              <MachineNode
                key={machine.machine_id}
                machine={machine}
                onClick={setSelectedMachine}
                isSelected={selectedMachine?.machine_id === machine.machine_id}
                vmStatus={vmStatuses[machine.machine_id]}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full bg-slate-100 rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <p className="text-sm text-slate-500">No machines match your filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-6">
          {selectedMachine ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
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
                    <p className="text-xs text-slate-400">{selectedMachine.type} &middot; {selectedMachine.location_zone}</p>
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
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Status</span>
                  <StatusBadge status={selectedMachine.status} />
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <IconTrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">Efficiency</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{(selectedMachine.efficiency_rating * 100).toFixed(1)}%</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <IconStack className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">Wafers</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{selectedMachine.current_wafer_count}</p>
                    <p className="text-[10px] text-slate-400">{selectedMachine.total_wafers_processed.toLocaleString()} total</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <IconBolt className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">Temperature</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">
                      {selectedMachine.temperature ? `${selectedMachine.temperature.toFixed(1)}°C` : '—'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <IconActivity className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">Vibration</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">
                      {selectedMachine.vibration ? selectedMachine.vibration.toFixed(2) : '—'}
                    </p>
                  </div>
                </div>

                {/* Analytics Button */}
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <IconChartBar className="w-4 h-4" />
                  View Analytics & Export
                </button>

                {/* Status Controls */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">Change Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['IDLE', 'RUNNING', 'MAINTENANCE', 'DOWN'] as MachineStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(selectedMachine.machine_id, s)}
                        disabled={selectedMachine.status === s || actionLoading === 'status'}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          selectedMachine.status === s
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        } disabled:opacity-50`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {(selectedMachine.status === 'DOWN' || selectedMachine.status === 'MAINTENANCE') && (
                    <button
                      onClick={() => handleRecover(selectedMachine.machine_id, selectedMachine.name)}
                      disabled={actionLoading === 'recover'}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <IconTool className="w-4 h-4" />
                      Recover Machine
                    </button>
                  )}

                  <div className="relative group">
                    <button
                      disabled={actionLoading === 'chaos'}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-slate-600 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <IconAlertTriangle className="w-4 h-4" />
                      Inject Failure
                    </button>
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button onClick={() => handleChaos(selectedMachine.machine_id, 'machine_down')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Machine Down</button>
                      <button onClick={() => handleChaos(selectedMachine.machine_id, 'sensor_spike')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Sensor Spike</button>
                      <button onClick={() => handleChaos(selectedMachine.machine_id, 'efficiency_drop')} className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">Efficiency Drop</button>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-900">{selectedMachine.location_zone}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Last Maintenance</span>
                    <span className="font-medium text-slate-900">
                      {selectedMachine.last_maintenance ? new Date(selectedMachine.last_maintenance).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  {isUsingMockData && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                      <IconAlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-amber-700">Demo Mode - Changes are local only</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mx-auto mb-4">
                <IconSearch className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900 mb-1">No Machine Selected</h3>
              <p className="text-xs text-slate-500">Click on a machine to view details, analytics, and controls</p>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Modal */}
      <AnalyticsModal
        machine={selectedMachine}
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        enableVM={true}
      />
    </div>
  );
}
