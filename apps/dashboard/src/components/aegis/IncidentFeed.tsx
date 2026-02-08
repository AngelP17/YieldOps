import { useState } from 'react';
import { IconCircleCheck, IconCircleX, IconShield, IconClock } from '@tabler/icons-react';
import type { AegisIncident, SeverityLevel } from '../../types';

interface IncidentFeedProps {
  incidents: AegisIncident[];
  onApprove?: (incidentId: string, approved: boolean) => void;
  onResolve?: (incidentId: string) => void;
}

const SEVERITY_STYLES: Record<SeverityLevel, { badge: string; dot: string }> = {
  critical: { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  high: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  low: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const ZONE_STYLES: Record<string, string> = {
  green: 'border-l-emerald-500',
  yellow: 'border-l-amber-500',
  red: 'border-l-rose-500',
};

export function IncidentFeed({ incidents, onApprove, onResolve }: IncidentFeedProps) {
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'pending'>('all');

  const filtered = incidents.filter(i => {
    if (filter === 'unresolved') return !i.resolved;
    if (filter === 'pending') return i.action_status === 'pending_approval';
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconShield className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Incident Feed</h3>
            <span className="text-xs text-slate-400">({filtered.length})</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            {(['all', 'unresolved', 'pending'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {filtered.map((incident) => {
          const severity = SEVERITY_STYLES[incident.severity];
          const zoneClass = ZONE_STYLES[incident.action_zone] || '';

          return (
            <div
              key={incident.incident_id}
              className={`px-5 py-3.5 border-l-4 ${zoneClass} hover:bg-slate-50/50 transition-colors`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${severity.badge}`}>
                      {incident.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-slate-700">{incident.machine_id}</span>
                    <span className="text-[10px] text-slate-400">{incident.incident_type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{incident.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <IconClock className="w-3 h-3" />
                      {new Date(incident.timestamp).toLocaleTimeString()}
                    </span>
                    {incident.z_score != null && (
                      <span>Z: {incident.z_score.toFixed(1)}</span>
                    )}
                    {incident.rate_of_change != null && (
                      <span>RoC: {incident.rate_of_change.toFixed(1)}/min</span>
                    )}
                    {incident.resolved && (
                      <span className="text-emerald-500 font-medium">Resolved</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {incident.action_status === 'pending_approval' && onApprove && (
                    <>
                      <button
                        onClick={() => onApprove(incident.incident_id, true)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors"
                      >
                        <IconCircleCheck className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => onApprove(incident.incident_id, false)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-rose-700 bg-rose-50 rounded hover:bg-rose-100 transition-colors"
                      >
                        <IconCircleX className="w-3 h-3" />
                        Reject
                      </button>
                    </>
                  )}
                  {!incident.resolved && onResolve && (
                    <button
                      onClick={() => onResolve(incident.incident_id)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                    >
                      <IconCircleCheck className="w-3 h-3" />
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-slate-400">No incidents match the current filter</div>
        )}
      </div>
    </div>
  );
}
