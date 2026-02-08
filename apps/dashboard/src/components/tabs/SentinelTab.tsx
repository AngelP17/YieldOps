import { useState } from 'react';
import { IconShield, IconAlertTriangle, IconActivity, IconCircleCheck } from '@tabler/icons-react';
import { KpiCard } from '../ui/KpiCard';
import { SentinelAgentCard } from '../aegis/SentinelAgentCard';
import { SafetyCircuitPanel } from '../aegis/SafetyCircuitPanel';
import { IncidentFeed } from '../aegis/IncidentFeed';
import { KnowledgeGraphViz } from '../aegis/KnowledgeGraphViz';
import { useAegisSentinel } from '../../hooks/useAegisSentinel';

export function SentinelTab() {
  const {
    summary,
    incidents,
    agents,
    safetyCircuit,
    knowledgeGraph,
    loading,
    approveIncident,
    resolveIncident,
    fetchKnowledgeGraph,
  } = useAegisSentinel({ pollingInterval: 10000 });

  const [graphLoading, setGraphLoading] = useState(false);

  const handleGenerateGraph = async () => {
    setGraphLoading(true);
    await fetchKnowledgeGraph();
    setGraphLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <IconShield className="w-8 h-8 text-slate-300 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-slate-400">Initializing Aegis Sentinel...</p>
        </div>
      </div>
    );
  }

  const autoResolved = incidents.filter(i => i.action_status === 'auto_executed' && i.resolved).length;
  const pendingApproval = incidents.filter(i => i.action_status === 'pending_approval').length;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Incidents (24h)"
          value={summary?.total_incidents_24h ?? 0}
          subtext={`${summary?.critical_incidents_24h ?? 0} critical`}
          icon={IconAlertTriangle}
          trend={summary?.critical_incidents_24h ? `-${summary.critical_incidents_24h}` : '+0'}
          color="rose"
        />
        <KpiCard
          label="Active Agents"
          value={`${summary?.active_agents ?? 0}/${agents.length}`}
          subtext="Sentinel coverage"
          icon={IconActivity}
          trend="+100%"
          color="emerald"
        />
        <KpiCard
          label="Auto-Resolved"
          value={autoResolved}
          subtext="Green zone actions"
          icon={IconCircleCheck}
          trend={`+${autoResolved}`}
          color="blue"
        />
        <KpiCard
          label="Pending Approval"
          value={pendingApproval}
          subtext="Yellow zone actions"
          icon={IconShield}
          trend={pendingApproval > 0 ? `-${pendingApproval}` : '+0'}
          color="amber"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Agents + Safety Circuit */}
        <div className="space-y-6">
          {/* Agent Cards */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Sentinel Agents</h3>
            <div className="space-y-3">
              {agents.map(agent => (
                <SentinelAgentCard key={agent.agent_id} agent={agent} />
              ))}
            </div>
          </div>

          {/* Safety Circuit */}
          {safetyCircuit && (
            <SafetyCircuitPanel status={safetyCircuit} />
          )}
        </div>

        {/* Center + Right: Incident Feed */}
        <div className="xl:col-span-2">
          <IncidentFeed
            incidents={incidents}
            onApprove={approveIncident}
            onResolve={resolveIncident}
          />
        </div>
      </div>

      {/* Knowledge Graph */}
      <div>
        {knowledgeGraph ? (
          <KnowledgeGraphViz
            data={knowledgeGraph}
            onGenerate={handleGenerateGraph}
            loading={graphLoading}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <IconShield className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Knowledge Graph</h3>
            <p className="text-xs text-slate-500 mb-4">
              Generate a relationship graph from incident data to visualize failure patterns and correlations.
            </p>
            <button
              onClick={handleGenerateGraph}
              disabled={graphLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {graphLoading ? 'Generating...' : 'Generate Graph'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
