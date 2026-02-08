import { useState, useEffect } from 'react';
import { IconShield, IconAlertTriangle, IconActivity, IconCircleCheck, IconMap, IconList, IconWifiOff } from '@tabler/icons-react';
import { KpiCard } from '../ui/KpiCard';
import { SafetyCircuitPanel } from '../aegis/SafetyCircuitPanel';
import { IncidentFeed } from '../aegis/IncidentFeed';
import { KnowledgeGraphViz } from '../aegis/KnowledgeGraphViz';
import { AgentTopology } from '../aegis/AgentTopology';
import { AgentCoveragePanel } from '../aegis/AgentCoveragePanel';
import { SentinelAgentList } from '../aegis/SentinelAgentList';
import { useAegisRealtime } from '../../hooks/useAegisRealtime';

export function SentinelTab() {
  const {
    summary,
    incidents,
    agents,
    facilitySummary,
    assemblySummary,
    loading,
    isDemoMode,
    approveIncident,
    resolveIncident,
  } = useAegisRealtime();

  // Knowledge graph data
  const [knowledgeGraph, setKnowledgeGraph] = useState<any>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'topology'>('list');

  const handleGenerateGraph = () => {
    setGraphLoading(true);
    
    // Get incidents to use (fallback to mock if none)
    const incidentsToUse = incidents.length > 0 ? incidents.slice(0, 10) : [
      { incident_id: 'demo-1', machine_id: 'LITHO-01', severity: 'critical', incident_type: 'thermal_runaway', agent_type: 'precision' },
      { incident_id: 'demo-2', machine_id: 'ETCH-01', severity: 'high', incident_type: 'vibration_alert', agent_type: 'facility' },
      { incident_id: 'demo-3', machine_id: 'DEP-01', severity: 'medium', incident_type: 'threshold_breach', agent_type: 'assembly' },
    ];
    
    // Generate nodes from incidents
    const nodes = incidentsToUse.map(i => ({
      data: { 
        id: i.incident_id, 
        label: i.incident_type, 
        type: i.agent_type || 'unknown',
        color: i.severity === 'critical' ? '#EF4444' : i.severity === 'high' ? '#F59E0B' : '#3B82F6'
      }
    }));
    
    // Add machine nodes
    const machineIds = [...new Set(incidentsToUse.map(i => i.machine_id))];
    machineIds.forEach((machineId) => {
      nodes.push({
        data: {
          id: `machine-${machineId}`,
          label: machineId,
          type: 'machine',
          color: '#10B981'
        }
      });
    });
    
    // Add severity nodes
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(sev => {
      nodes.push({
        data: {
          id: `severity-${sev}`,
          label: sev.charAt(0).toUpperCase() + sev.slice(1),
          type: 'severity',
          color: sev === 'critical' ? '#EF4444' : sev === 'high' ? '#F59E0B' : sev === 'medium' ? '#F59E0B' : '#3B82F6'
        }
      });
    });
    
    // Generate edges - MUST have edges
    const edges: any[] = [];
    
    // Connect each incident to its machine
    incidentsToUse.forEach(i => {
      edges.push({
        data: {
          id: `edge-${i.incident_id}`,
          source: i.incident_id,
          target: `machine-${i.machine_id}`,
          label: 'occurred_on',
          weight: 2
        }
      });
    });
    
    // Connect each incident to its severity
    incidentsToUse.forEach(i => {
      edges.push({
        data: {
          id: `sev-${i.incident_id}`,
          source: i.incident_id,
          target: `severity-${i.severity}`,
          label: 'has_severity',
          weight: 1
        }
      });
    });
    
    // Connect machines to each other (factory floor)
    for (let i = 0; i < machineIds.length - 1; i++) {
      edges.push({
        data: {
          id: `mach-conn-${i}`,
          source: `machine-${machineIds[i]}`,
          target: `machine-${machineIds[i + 1]}`,
          label: 'connected_to',
          weight: 1
        }
      });
    }
    
    setKnowledgeGraph({ 
      nodes, 
      edges, 
      stats: { 
        node_count: nodes.length, 
        edge_count: edges.length,
        central_concepts: machineIds.slice(0, 3).map((m) => [m, 0.75])
      } 
    });
    
    setGraphLoading(false);
  };

  // Auto-generate knowledge graph on mount
  useEffect(() => {
    if (!knowledgeGraph && !graphLoading) {
      handleGenerateGraph();
    }
  }, []);

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

  // Calculate stats from actual data
  const totalIncidents = summary?.total_incidents_24h ?? incidents.length;
  const criticalCount = summary?.critical_incidents_24h ?? incidents.filter(i => i.severity === 'critical').length;
  const activeAgentCount = summary?.active_agents ?? agents.filter(a => a.status === 'active').length;
  const totalAgentCount = agents.length;
  
  const autoResolved = incidents.filter(i => i.action_status === 'auto_executed' && i.resolved).length;
  const pendingApproval = incidents.filter(i => i.action_status === 'pending_approval').length;
  
  // Build safety circuit status
  const greenCount = incidents.filter(i => i.action_zone === 'green').length;
  const redCount = incidents.filter(i => i.action_zone === 'red').length;
  
  const safetyCircuit = {
    green_actions_24h: greenCount,
    yellow_pending: pendingApproval,
    red_alerts_24h: redCount,
    agents_active: activeAgentCount,
    agents_total: totalAgentCount,
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Indicator - minimal */}
      {isDemoMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
          <IconWifiOff className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-amber-700">Demo Mode - Sample Data</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Incidents (24h)"
          value={totalIncidents}
          subtext={`${criticalCount} critical`}
          icon={IconAlertTriangle}
          trend={criticalCount > 0 ? `+${criticalCount}` : '+0'}
          color="rose"
        />
        <KpiCard
          label="Active Agents"
          value={`${activeAgentCount}/${totalAgentCount}`}
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

      {/* Sand-to-Package Coverage */}
      <AgentCoveragePanel 
        facilitySummary={facilitySummary}
        assemblySummary={assemblySummary}
      />

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
            {/* Organized Agent List */}
            <SentinelAgentList agents={agents} />

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
