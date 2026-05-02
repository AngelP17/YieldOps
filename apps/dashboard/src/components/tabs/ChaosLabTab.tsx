import { useState } from 'react';
import {
  IconFlask, IconBolt, IconPlayerPlay, IconRefresh,
  IconAlertTriangle, IconCheck, IconClock, IconShield,
  IconTrendingDown, IconThermometer, IconActivity, IconCpu
} from '@tabler/icons-react';
import { useToast } from '../ui/Toast';
import { useAppConfig } from '../../App';

interface ChaosScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  impact: 'low' | 'medium' | 'high' | 'critical';
  duration: string;
}

const SCENARIOS: ChaosScenario[] = [
  { id: 'machine_down', name: 'Machine Down', description: 'Simulate sudden machine failure during production', icon: IconCpu, impact: 'high', duration: '5-15 min' },
  { id: 'sensor_spike', name: 'Sensor Spike', description: 'Inject abnormal temperature/vibration readings', icon: IconThermometer, impact: 'medium', duration: '2-5 min' },
  { id: 'efficiency_drop', name: 'Efficiency Drop', description: 'Gradual performance degradation pattern', icon: IconTrendingDown, impact: 'medium', duration: '10-30 min' },
  { id: 'hot_lot_injection', name: 'Hot Lot Injection', description: 'Unexpected high-priority job arrival', icon: IconBolt, impact: 'high', duration: 'Immediate' },
  { id: 'network_partition', name: 'Network Partition', description: 'Simulate connectivity loss between zones', icon: IconShield, impact: 'critical', duration: '1-10 min' },
  { id: 'power_fluctuation', name: 'Power Fluctuation', description: 'Voltage irregularity affecting tool stability', icon: IconActivity, impact: 'medium', duration: '30-60 sec' },
];

const MOCK_LOGS = [
  { id: 1, timestamp: '2024-12-16 10:23:15', scenario: 'Machine Down', target: 'ETCH-05', status: 'resolved', duration: '8 min', impact: '2 jobs delayed' },
  { id: 2, timestamp: '2024-12-16 09:45:30', scenario: 'Sensor Spike', target: 'LITHO-02', status: 'resolved', duration: '3 min', impact: 'VM alert triggered' },
  { id: 3, timestamp: '2024-12-16 08:12:00', scenario: 'Hot Lot Injection', target: 'Dispatch Queue', status: 'resolved', duration: 'Immediate', impact: 'Queue reordered' },
  { id: 4, timestamp: '2024-12-16 07:30:45', scenario: 'Efficiency Drop', target: 'DEP-03', status: 'resolved', duration: '15 min', impact: 'R2R adjusted' },
];

export function ChaosLabTab() {
  const { toast } = useToast();
  const { machines, updateMachine } = useAppConfig();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [blastRadius, setBlastRadius] = useState<string[]>([]);

  const handleSimulate = (scenario: ChaosScenario) => {
    setRunning(true);
    setActiveScenario(scenario.id);

    // Calculate blast radius
    const runningMachines = machines.filter(m => m.status === 'RUNNING');
    const affected = runningMachines.slice(0, Math.floor(Math.random() * 3) + 1).map(m => m.name);
    setBlastRadius(affected);

    setTimeout(() => {
      setRunning(false);
      
      // Add log entry
      const newLog = {
        id: logs.length + 1,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        scenario: scenario.name,
        target: affected[0] || 'System',
        status: 'resolved',
        duration: scenario.duration,
        impact: 'Test completed successfully',
      };
      setLogs(prev => [newLog, ...prev]);

      toast(`Chaos scenario "${scenario.name}" completed. ${affected.length} machines affected.`, 'success');
    }, 2000);
  };

  const handleRecover = () => {
    const broken = machines.filter(m => m.status === 'DOWN');
    broken.forEach(m => updateMachine(m.machine_id, { status: 'IDLE', efficiency_rating: 0.90 }));
    toast(`Recovered ${broken.length} machines to IDLE status`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Chaos & Resilience Lab</h2>
          <p className="text-sm text-zinc-500">Controlled failure injection and recovery validation</p>
        </div>
        <button 
          onClick={handleRecover}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <IconRefresh className="w-4 h-4" />
          Recover All
        </button>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const isActive = activeScenario === scenario.id;
          const impactColors = {
            low: 'border-emerald-200 bg-emerald-50',
            medium: 'border-amber-200 bg-amber-50',
            high: 'border-orange-200 bg-orange-50',
            critical: 'border-rose-200 bg-rose-50',
          };
          const impactText = {
            low: 'text-emerald-700',
            medium: 'text-amber-700',
            high: 'text-orange-700',
            critical: 'text-rose-700',
          };

          return (
            <div
              key={scenario.id}
              className={`rounded-xl border p-4 transition-all ${
                isActive ? 'border-zinc-900 ring-2 ring-zinc-200' : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${impactColors[scenario.impact]}`}>
                  <Icon className={`w-5 h-5 ${impactText[scenario.impact]}`} />
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${impactColors[scenario.impact]} ${impactText[scenario.impact]}`}>
                  {scenario.impact}
                </span>
              </div>
              
              <h3 className="font-semibold text-zinc-900 mb-1">{scenario.name}</h3>
              <p className="text-sm text-zinc-500 mb-3">{scenario.description}</p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <IconClock className="w-3 h-3" />
                  {scenario.duration}
                </span>
                <button
                  onClick={() => handleSimulate(scenario)}
                  disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {running && isActive ? (
                    <IconRefresh className="w-3 h-3 animate-spin" />
                  ) : (
                    <IconPlayerPlay className="w-3 h-3" />
                  )}
                  {running && isActive ? 'Running...' : 'Simulate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Blast Radius & System Response */}
      {blastRadius.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <IconAlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-zinc-900">Blast Radius</h3>
            </div>
            <div className="space-y-2">
              {blastRadius.map((machine) => (
                <div key={machine} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-sm font-medium text-zinc-900">{machine}</span>
                  <span className="text-xs text-amber-600 ml-auto">Affected</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <IconShield className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-zinc-900">System Response</h3>
            </div>
            <div className="space-y-2">
              {[
                { step: 'Detection', status: 'complete', time: '< 2s' },
                { step: 'Alert Dispatch', status: 'complete', time: '< 5s' },
                { step: 'Auto-Containment', status: 'complete', time: '< 10s' },
                { step: 'Recovery Initiated', status: 'complete', time: '< 30s' },
              ].map((step) => (
                <div key={step.step} className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <IconCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-zinc-700">{step.step}</span>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium">{step.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Experiment Log */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <IconFlask className="w-5 h-5 text-zinc-600" />
          <h3 className="font-semibold text-zinc-900">Experiment Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Time</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Scenario</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Target</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Status</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Duration</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Impact</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="py-2 px-3 text-zinc-700 font-mono text-xs">{log.timestamp}</td>
                  <td className="py-2 px-3 text-zinc-900 font-medium">{log.scenario}</td>
                  <td className="py-2 px-3 text-zinc-600">{log.target}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      log.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                      log.status === 'running' ? 'bg-amber-100 text-amber-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-zinc-600">{log.duration}</td>
                  <td className="py-2 px-3 text-zinc-600 text-xs">{log.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
