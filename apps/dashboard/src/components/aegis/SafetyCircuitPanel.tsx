import { IconShieldCheck, IconShieldExclamation, IconAlertTriangle } from '@tabler/icons-react';
import type { SafetyCircuitStatus } from '../../types';

interface SafetyCircuitPanelProps {
  status: SafetyCircuitStatus;
}

export function SafetyCircuitPanel({ status }: SafetyCircuitPanelProps) {
  const total = status.green_actions_24h + status.yellow_pending + status.red_alerts_24h;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Safety Circuit</h3>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium">{status.agents_active}/{status.agents_total}</span> agents
        </div>
      </div>

      {/* 3-Tier Visual */}
      <div className="space-y-3 mb-4">
        {/* Green Zone */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-emerald-50 rounded-lg">
            <IconShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">Green Zone</span>
              <span className="text-sm font-bold text-emerald-600">{status.green_actions_24h}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: total > 0 ? `${(status.green_actions_24h / total) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Auto-executed actions</p>
          </div>
        </div>

        {/* Yellow Zone */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-amber-50 rounded-lg">
            <IconAlertTriangle className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">Yellow Zone</span>
              <span className="text-sm font-bold text-amber-600">{status.yellow_pending}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: total > 0 ? `${(status.yellow_pending / total) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Pending operator approval</p>
          </div>
        </div>

        {/* Red Zone */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-rose-50 rounded-lg">
            <IconShieldExclamation className="w-4.5 h-4.5 text-rose-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">Red Zone</span>
              <span className="text-sm font-bold text-rose-600">{status.red_alerts_24h}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: total > 0 ? `${(status.red_alerts_24h / total) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Critical alerts (manual only)</p>
          </div>
        </div>
      </div>

      {/* Last Incident */}
      {status.last_incident && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Last Incident</p>
          <p className="text-xs text-slate-600 truncate">{status.last_incident.message}</p>
        </div>
      )}
    </div>
  );
}
