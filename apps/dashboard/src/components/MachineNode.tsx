import React from 'react';
import { IconActivity, IconAlertTriangle, IconCircleCheck, IconPlayerPause, IconThermometer, IconBolt, IconMicroscope } from '@tabler/icons-react';
import type { Machine, MachineStatus } from '../types';

interface MachineNodeProps {
  machine: Machine;
  onClick?: (machine: Machine) => void;
  isSelected?: boolean;
  vmStatus?: {
    has_prediction: boolean;
    predicted_thickness_nm?: number;
    confidence_score?: number;
    needs_correction?: boolean;
  };
}

const statusConfig: Record<MachineStatus, { 
  gradient: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  label: string;
  dotColor: string;
}> = {
  IDLE: {
    gradient: 'from-emerald-500/10 to-emerald-600/5',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: IconCircleCheck,
    label: 'Idle',
    dotColor: 'bg-emerald-500',
  },
  RUNNING: {
    gradient: 'from-blue-500/10 to-blue-600/5',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: IconActivity,
    label: 'Running',
    dotColor: 'bg-blue-500',
  },
  DOWN: {
    gradient: 'from-rose-500/10 to-rose-600/5',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    icon: IconAlertTriangle,
    label: 'Down',
    dotColor: 'bg-rose-500',
  },
  MAINTENANCE: {
    gradient: 'from-amber-500/10 to-amber-600/5',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: IconPlayerPause,
    label: 'Maintenance',
    dotColor: 'bg-amber-500',
  }
};

export const MachineNode: React.FC<MachineNodeProps> = ({
  machine,
  onClick,
  isSelected = false,
  vmStatus
}) => {
  const config = statusConfig[machine.status];
  const StatusIcon = config.icon;
  
  // Efficiency color
  const getEfficiencyColor = (eff: number) => {
    if (eff >= 0.9) return 'text-emerald-600';
    if (eff >= 0.8) return 'text-blue-600';
    if (eff >= 0.7) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getEfficiencyBg = (eff: number) => {
    if (eff >= 0.9) return 'bg-emerald-500';
    if (eff >= 0.8) return 'bg-blue-500';
    if (eff >= 0.7) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const isRunning = machine.status === 'RUNNING';

  return (
    <div
      onClick={() => onClick?.(machine)}
      className={`
        relative group cursor-pointer rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${isSelected 
          ? 'border-slate-900 shadow-xl shadow-slate-200 scale-[1.02]' 
          : 'border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50'
        }
      `}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-50`} />
      
      {/* Animated Status Line for Running Machines */}
      {isRunning && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 animate-pulse" />
      )}
      
      {/* Content */}
      <div className="relative p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Status Icon */}
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-xl 
              ${config.bgColor} ${config.borderColor} border
            `}>
              <StatusIcon className={`w-5 h-5 ${isRunning ? 'text-blue-600' : 'text-slate-600'}`} />
            </div>
            
            {/* Machine Info */}
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">{machine.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${isRunning ? 'animate-pulse' : ''}`} />
                <span className="text-xs text-slate-500">{config.label}</span>
              </div>
            </div>
          </div>
          
          {/* Efficiency Badge */}
          <div className={`
            px-2.5 py-1 rounded-lg text-xs font-bold
            ${machine.efficiency_rating >= 0.9 ? 'bg-emerald-100 text-emerald-700' :
              machine.efficiency_rating >= 0.8 ? 'bg-blue-100 text-blue-700' :
              machine.efficiency_rating >= 0.7 ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'}
          `}>
            {(machine.efficiency_rating * 100).toFixed(0)}%
          </div>
        </div>
        
        {/* VM Status Badge */}
        {vmStatus?.has_prediction && (
          <div className="mb-3">
            <div className={`
              inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium
              ${vmStatus.needs_correction 
                ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}
            `}>
              <IconMicroscope className="w-3 h-3" />
              <span>VM: {vmStatus.predicted_thickness_nm?.toFixed(1)}nm</span>
              {vmStatus.needs_correction && (
                <span className="ml-1 text-amber-600 flex items-center gap-0.5">
                  <IconAlertTriangle className="w-3 h-3" /> R2R
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Efficiency Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Performance</span>
            <span className={`font-semibold ${getEfficiencyColor(machine.efficiency_rating)}`}>
              {machine.efficiency_rating >= 0.9 ? 'Excellent' :
               machine.efficiency_rating >= 0.8 ? 'Good' :
               machine.efficiency_rating >= 0.7 ? 'Fair' : 'Poor'}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ease-out ${getEfficiencyBg(machine.efficiency_rating)}`}
              style={{ width: `${machine.efficiency_rating * 100}%` }}
            />
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Wafer Count */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-slate-100">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Wafers</p>
            <p className="text-lg font-bold text-slate-900">{machine.current_wafer_count}</p>
          </div>
          
          {/* Temperature */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-slate-100">
            <div className="flex items-center gap-1 mb-1">
              <IconThermometer className="w-3 h-3 text-slate-400" />
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Temp</p>
            </div>
            <p className={`text-lg font-bold ${
              machine.temperature && machine.temperature > machine.max_temperature * 0.9 
                ? 'text-rose-600' 
                : 'text-slate-900'
            }`}>
              {machine.temperature ? `${machine.temperature.toFixed(0)}°` : '—'}
            </p>
          </div>
          
          {/* Vibration */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-slate-100">
            <div className="flex items-center gap-1 mb-1">
              <IconBolt className="w-3 h-3 text-slate-400" />
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Vib</p>
            </div>
            <p className={`text-lg font-bold ${
              machine.vibration && machine.vibration > machine.max_vibration * 0.8 
                ? 'text-rose-600' 
                : 'text-slate-900'
            }`}>
              {machine.vibration ? machine.vibration.toFixed(1) : '—'}
            </p>
          </div>
        </div>
        
        {/* Location & Zone */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{machine.location_zone}</span>
            <span className="text-slate-400">{machine.total_wafers_processed.toLocaleString()} processed</span>
          </div>
        </div>
      </div>
      
      {/* Hover Effect Overlay */}
      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/[0.02] transition-colors duration-300 pointer-events-none" />
    </div>
  );
};

export default MachineNode;
