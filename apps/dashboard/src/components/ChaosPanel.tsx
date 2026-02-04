import React, { useState } from 'react';
import { 
  Bomb, 
  Activity, 
  Thermometer, 
  Zap, 
  AlertTriangle, 
  Power,
  RotateCcw,
  Skull,
  Gauge,
  Cpu,
  CheckCircle2,
  Timer
} from 'lucide-react';

interface ChaosEvent {
  id: string;
  type: 'thermal_runaway' | 'vibration_spike' | 'power_fluctuation' | 'communication_loss' | 'sensor_drift';
  machineId: string;
  machineName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  status: 'injected' | 'detected' | 'mitigated' | 'resolved';
  mitigationAction?: string;
}

const CHAOS_SCENARIOS = [
  {
    id: 'thermal_runaway',
    name: 'Thermal Runaway',
    description: 'Simulate extreme temperature spike in lithography unit',
    icon: Thermometer,
    color: 'from-orange-500 to-red-600',
    severity: 'critical' as const,
  },
  {
    id: 'vibration_spike',
    name: 'Vibration Anomaly',
    description: 'Inject high-frequency vibration in etching chamber',
    icon: Activity,
    color: 'from-amber-500 to-orange-600',
    severity: 'high' as const,
  },
  {
    id: 'power_fluctuation',
    name: 'Power Fluctuation',
    description: 'Simulate voltage instability in deposition bay',
    icon: Zap,
    color: 'from-yellow-500 to-amber-600',
    severity: 'medium' as const,
  },
  {
    id: 'communication_loss',
    name: 'Communication Loss',
    description: 'Disconnect sensor telemetry from inspection unit',
    icon: Power,
    color: 'from-slate-500 to-slate-600',
    severity: 'high' as const,
  },
  {
    id: 'sensor_drift',
    name: 'Sensor Drift',
    description: 'Gradual calibration error in temperature sensors',
    icon: Gauge,
    color: 'from-blue-500 to-indigo-600',
    severity: 'low' as const,
  },
];

const MOCK_EVENTS: ChaosEvent[] = [
  {
    id: '1',
    type: 'thermal_runaway',
    machineId: '1',
    machineName: 'Litho-A1',
    severity: 'critical',
    description: 'Temperature exceeded 95°C threshold',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    status: 'mitigated',
    mitigationAction: 'Auto-shutdown initiated, cooling engaged',
  },
  {
    id: '2',
    type: 'vibration_spike',
    machineId: '4',
    machineName: 'Etch-C1',
    severity: 'high',
    description: 'Vibration levels at 8.5σ above normal',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    status: 'resolved',
    mitigationAction: 'Load redistributed to Etch-C2',
  },
];

export const ChaosPanel: React.FC = () => {
  const [events, setEvents] = useState<ChaosEvent[]>(MOCK_EVENTS);
  const [isInjecting, setIsInjecting] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<typeof CHAOS_SCENARIOS[0] | null>(null);

  const injectChaos = (scenario: typeof CHAOS_SCENARIOS[0]) => {
    setIsInjecting(true);
    setActiveScenario(scenario.id);

    // Simulate API call
    setTimeout(() => {
      const newEvent: ChaosEvent = {
        id: Date.now().toString(),
        type: scenario.id as ChaosEvent['type'],
        machineId: Math.floor(Math.random() * 12 + 1).toString(),
        machineName: `Machine-${Math.floor(Math.random() * 12 + 1)}`,
        severity: scenario.severity,
        description: scenario.description,
        timestamp: new Date(),
        status: 'injected',
      };

      setEvents(prev => [newEvent, ...prev]);
      setIsInjecting(false);
      setActiveScenario(null);
      setShowConfirmation(false);
    }, 2000);
  };

  const handleScenarioClick = (scenario: typeof CHAOS_SCENARIOS[0]) => {
    setSelectedScenario(scenario);
    setShowConfirmation(true);
  };

  const getStatusIcon = (status: ChaosEvent['status']) => {
    switch (status) {
      case 'injected':
        return <Bomb className="w-4 h-4 text-rose-500" />;
      case 'detected':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'mitigated':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: ChaosEvent['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Chaos Control Panel */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-rose-500/20 rounded-xl">
                <Skull className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Chaos Engineering</h3>
                <p className="text-xs text-slate-400">Test system resilience with controlled failures</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-xs font-medium text-rose-400">System Armed</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Chaos Scenarios Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {CHAOS_SCENARIOS.map((scenario) => {
              const Icon = scenario.icon;
              const isActive = activeScenario === scenario.id;
              
              return (
                <button
                  key={scenario.id}
                  onClick={() => handleScenarioClick(scenario)}
                  disabled={isInjecting}
                  className={`
                    relative group p-4 rounded-xl border transition-all duration-300 text-left
                    ${isActive 
                      ? 'bg-rose-500/20 border-rose-500/50' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${scenario.color}
                      shadow-lg
                    `}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className={`
                      px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider
                      ${scenario.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                        scenario.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        scenario.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'}
                    `}>
                      {scenario.severity}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{scenario.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{scenario.description}</p>
                  
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-rose-400 animate-spin" />
                        <span className="text-xs font-medium text-rose-400">Injecting...</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Big Red Button */}
          <div className="flex justify-center">
            <button
              onClick={() => handleScenarioClick(CHAOS_SCENARIOS[0])}
              disabled={isInjecting}
              className="
                relative group
                px-8 py-4 bg-gradient-to-b from-rose-500 to-rose-700 
                rounded-2xl border-2 border-rose-400/50
                shadow-[0_0_40px_rgba(244,63,94,0.3)]
                hover:shadow-[0_0_60px_rgba(244,63,94,0.5)]
                hover:from-rose-400 hover:to-rose-600
                active:scale-95
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <div className="flex items-center gap-3">
                <Bomb className="w-6 h-6 text-white" />
                <div className="text-left">
                  <span className="block text-lg font-bold text-white">INJECT CHAOS</span>
                  <span className="block text-xs text-rose-200">Trigger Random Failure</span>
                </div>
              </div>
              
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-rose-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg">
              <Activity className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Chaos Event Log</h3>
              <p className="text-xs text-slate-500">Recent failure injections and system responses</p>
            </div>
          </div>
          <button 
            onClick={() => setEvents([])}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {events.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No chaos events recorded</p>
              <p className="text-xs text-slate-400 mt-1">Inject a failure to see system response</p>
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">
                    {getStatusIcon(event.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {CHAOS_SCENARIOS.find(s => s.id === event.type)?.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityColor(event.severity)}`}>
                            {event.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{event.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {event.machineName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatTimeAgo(event.timestamp)}
                          </span>
                        </div>
                      </div>
                      <span className={`
                        px-2.5 py-1 rounded-full text-xs font-medium
                        ${event.status === 'injected' ? 'bg-rose-100 text-rose-700' :
                          event.status === 'detected' ? 'bg-amber-100 text-amber-700' :
                          event.status === 'mitigated' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'}
                      `}>
                        {event.status}
                      </span>
                    </div>
                    {event.mitigationAction && (
                      <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-emerald-800">Auto-Mitigation Applied</p>
                            <p className="text-xs text-emerald-600 mt-0.5">{event.mitigationAction}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
                <h3 className="text-lg font-semibold text-rose-900">Confirm Chaos Injection</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                You are about to inject a <strong>{selectedScenario.name}</strong> failure into the system. 
                This will test the resilience of your manufacturing control systems.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Scenario</p>
                <p className="text-sm font-medium text-slate-900">{selectedScenario.name}</p>
                <p className="text-xs text-slate-500 mt-1">{selectedScenario.description}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-slate-500">Severity:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    selectedScenario.severity === 'critical' ? 'bg-rose-100 text-rose-700' :
                    selectedScenario.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    selectedScenario.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedScenario.severity.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => injectChaos(selectedScenario)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors"
                >
                  Inject Chaos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default ChaosPanel;
