import React from 'react';
import { Activity, AlertTriangle, CheckCircle, Pause } from 'lucide-react';
import type { Machine, MachineStatus } from '../types';

interface MachineNodeProps {
  machine: Machine;
  onClick?: (machine: Machine) => void;
  isSelected?: boolean;
}

const statusConfig: Record<MachineStatus, { 
  color: string; 
  bgColor: string;
  icon: React.ElementType;
  label: string;
}> = {
  IDLE: {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle,
    label: 'Idle'
  },
  RUNNING: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: Activity,
    label: 'Running'
  },
  DOWN: {
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    icon: AlertTriangle,
    label: 'Down'
  },
  MAINTENANCE: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: Pause,
    label: 'Maintenance'
  }
};

export const MachineNode: React.FC<MachineNodeProps> = ({ 
  machine, 
  onClick,
  isSelected = false 
}) => {
  const config = statusConfig[machine.status];
  const StatusIcon = config.icon;
  
  // Efficiency color gradient
  const getEfficiencyColor = (eff: number) => {
    if (eff >= 0.9) return 'text-emerald-600';
    if (eff >= 0.8) return 'text-blue-600';
    if (eff >= 0.7) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div
      onClick={() => onClick?.(machine)}
      className={`
        relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer
        ${config.bgColor}
        ${isSelected ? 'ring-4 ring-blue-400 scale-105' : 'hover:scale-102 hover:shadow-lg'}
      `}
    >
      {/* Status Indicator */}
      <div className={`
        absolute -top-2 -right-2 w-4 h-4 rounded-full animate-pulse
        ${machine.status === 'RUNNING' ? 'bg-blue-500' : 
          machine.status === 'IDLE' ? 'bg-emerald-500' : 
          machine.status === 'DOWN' ? 'bg-red-500' : 'bg-amber-500'}
      `} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
          <span className="font-semibold text-gray-800">{machine.name}</span>
        </div>
        <span className={`
          px-2 py-0.5 text-xs font-medium rounded-full
          ${config.bgColor} ${config.color}
        `}>
          {config.label}
        </span>
      </div>
      
      {/* Machine Type */}
      <div className="text-sm text-gray-500 mb-3 capitalize">
        {machine.type.replace('_', ' ')}
      </div>
      
      {/* Metrics */}
      <div className="space-y-2">
        {/* Efficiency Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Efficiency</span>
            <span className={`font-medium ${getEfficiencyColor(machine.efficiency_rating)}`}>
              {(machine.efficiency_rating * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                machine.efficiency_rating >= 0.9 ? 'bg-emerald-500' :
                machine.efficiency_rating >= 0.8 ? 'bg-blue-500' :
                machine.efficiency_rating >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${machine.efficiency_rating * 100}%` }}
            />
          </div>
        </div>
        
        {/* Wafer Count */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Wafers</span>
          <span className="text-sm font-medium text-gray-700">
            {machine.current_wafer_count}
          </span>
        </div>
        
        {/* Sensor Data */}
        {(machine.temperature !== undefined || machine.vibration !== undefined) && (
          <div className="pt-2 border-t border-gray-200 mt-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {machine.temperature !== undefined && (
                <div>
                  <span className="text-gray-400">Temp:</span>
                  <span className={`ml-1 font-medium ${
                    machine.temperature > 80 ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {machine.temperature.toFixed(1)}°C
                  </span>
                </div>
              )}
              {machine.vibration !== undefined && (
                <div>
                  <span className="text-gray-400">Vib:</span>
                  <span className={`ml-1 font-medium ${
                    machine.vibration > 4 ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {machine.vibration.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineNode;
