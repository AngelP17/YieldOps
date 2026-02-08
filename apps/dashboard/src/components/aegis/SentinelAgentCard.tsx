import { IconShield, IconRadio, IconActivity, IconCpu } from '@tabler/icons-react';
import type { AegisAgent } from '../../types';

interface SentinelAgentCardProps {
  agent: AegisAgent;
  variant?: 'default' | 'compact';
}

const AGENT_CONFIG: Record<string, { label: string; icon: typeof IconShield; color: string; bgColor: string }> = {
  precision: { label: 'Precision Agent', icon: IconCpu, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  facility: { label: 'Facility Agent', icon: IconShield, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  assembly: { label: 'Assembly Agent', icon: IconActivity, color: 'text-purple-600', bgColor: 'bg-purple-50' },
};

export function SentinelAgentCard({ agent, variant = 'default' }: SentinelAgentCardProps) {
  const config = AGENT_CONFIG[agent.agent_type] || AGENT_CONFIG.precision;
  const Icon = config.icon;
  const isActive = agent.status === 'active';

  if (variant === 'compact') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md hover:shadow-slate-200/50 transition-all duration-300">
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
          </div>
        </div>

        <div className="mb-2">
          <h4 className="text-xs font-semibold text-slate-900 truncate">{config.label}</h4>
          <p className="text-[10px] text-slate-500 truncate">{agent.machine_id}</p>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-900">{agent.detections_24h}</span>
            <span className="text-slate-500">detections</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <span className="font-medium">{agent.uptime_hours.toFixed(0)}h</span>
            <span>up</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{config.label}</h4>
            <p className="text-xs text-slate-500">{agent.machine_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
          <span className={`text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
            {isActive ? 'Active' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-lg font-bold text-slate-900">{agent.detections_24h}</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Detections 24h</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-lg font-bold text-slate-900">{agent.uptime_hours.toFixed(0)}h</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Uptime</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-[10px] font-medium text-slate-600">
          <IconRadio className="w-3 h-3" />
          {agent.protocol.toUpperCase()}
        </div>
        {agent.capabilities.slice(0, 2).map((cap) => (
          <span key={cap} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-medium text-slate-500 truncate max-w-[100px]">
            {cap.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
