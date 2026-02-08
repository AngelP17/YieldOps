import { useState, useEffect } from 'react';
import { IconShield, IconAlertTriangle, IconActivity, IconCircleCheck, IconMap, IconList } from '@tabler/icons-react';
import { KpiCard } from '../ui/KpiCard';
import { SentinelAgentCard } from '../aegis/SentinelAgentCard';
import { SafetyCircuitPanel } from '../aegis/SafetyCircuitPanel';
import { IncidentFeed } from '../aegis/IncidentFeed';
import { KnowledgeGraphViz } from '../aegis/KnowledgeGraphViz';
import { AgentTopology } from '../aegis/AgentTopology';
import { useAegisSentinel } from '../../hooks/useAegisSentinel';

export function SentinelTab() {
  const {
    summary,
    incidents,
    agents,
    safetyCircuit,
    knowledgeGraph,
    loading,
    isDemoMode,
    approveIncident,
    resolveIncident,
    fetchKnowledgeGraph,
  } = useAegisSentinel({ pollingInterval: 10000 });

  const [graphLoading, setGraphLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'topology'>('list');

  const handleGenerateGraph = async () => {
    setGraphLoading(true);
    await fetchKnowledgeGraph();
    setGraphLoading(false);
  };

  // Auto-generate knowledge graph on mount
  useEffect(() => {
    if (!knowledgeGraph && !graphLoading) {
      handleGenerateGraph();
    }
  }, [knowledgeGraph, graphLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <IconAlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800">Demo Mode Active</p>
            <p className="text-xs text-amber-700">Aegis Sentinel data is simulated. Configure VITE_API_URL to connect to real sentinel agents.</p>
          </div>
        </div>
      )}

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

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Sentinel Coverage</h3>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <IconList className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('topology')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'topology'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <IconMap className="w-4 h-4" />
            Topology
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      {viewMode === 'list' ? (
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
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Agent Topology */}
          <AgentTopology
            agents={agents}
            incidents={incidents.map(i => ({ ...i, action_zone: i.action_zone }))}
          />

          {/* Safety Circuit + Incidents */}
          <div className="space-y-6">
            {safetyCircuit && (
              <SafetyCircuitPanel status={safetyCircuit} />
            )}
            <IncidentFeed
              incidents={incidents}
              onApprove={approveIncident}
              onResolve={resolveIncident}
            />
          </div>
        </div>
      )}

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
            <IconShield className={`w-8 h-8 mx-auto mb-3 ${graphLoading ? 'text-blue-400 animate-pulse' : 'text-slate-300'}`} />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Knowledge Graph</h3>
            <p className="text-xs text-slate-500 mb-4">
              {graphLoading 
                ? 'Generating relationship graph from incident data...' 
                : 'Visualize failure patterns and correlations across your system.'}
            </p>
            {graphLoading ? (
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              <button
                onClick={handleGenerateGraph}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Generate Graph
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
