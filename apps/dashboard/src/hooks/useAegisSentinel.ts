import { useState, useEffect, useCallback, useRef } from 'react';
import { api, isApiConfigured } from '../services/apiClient';
import type {
  AegisIncident,
  AegisAgent,
  SafetyCircuitStatus,
  SentinelSummary,
  KnowledgeGraphData,
  SeverityLevel,
  SafetyZone,
  ActionStatus,
  AgentType,
} from '../types';

interface UseAegisSentinelOptions {
  pollingInterval?: number;
}

// -------------------------------------------------------------------
// Mock data generators (backend-only mode, but we need demo fallback)
// -------------------------------------------------------------------

const MACHINE_IDS = ['LITHO-01', 'LITHO-02', 'ETCH-01', 'ETCH-02', 'DEP-01', 'DEP-02', 'INSP-01', 'CLEAN-01'];
const INCIDENT_TYPES = ['thermal_runaway', 'bearing_failure', 'coolant_leak', 'elevated_temperature', 'increased_vibration', 'bearing_wear'];
const ACTIONS = ['emergency_stop', 'reduce_thermal_load', 'increase_coolant', 'alert_maintenance', 'schedule_inspection'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockIncident(index: number): AegisIncident {
  const severities: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
  const severity = randomFrom(severities);
  const zone: SafetyZone = severity === 'critical' ? 'red' : severity === 'high' ? 'yellow' : 'green';
  const statusMap: Record<SafetyZone, ActionStatus> = { green: 'auto_executed', yellow: 'pending_approval', red: 'alert_only' };
  const machineId = randomFrom(MACHINE_IDS);
  const incidentType = randomFrom(INCIDENT_TYPES);
  const action = randomFrom(ACTIONS);
  const temp = 60 + Math.random() * 50;

  return {
    incident_id: `mock-inc-${Date.now()}-${index}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    machine_id: machineId,
    severity,
    incident_type: incidentType,
    message: `${severity.toUpperCase()}: ${incidentType.replace(/_/g, ' ')} detected on ${machineId} (${temp.toFixed(1)}C)`,
    detected_value: temp,
    threshold_value: severity === 'critical' ? 105 : severity === 'high' ? 95 : 80,
    action_taken: action,
    action_status: statusMap[zone],
    action_zone: zone,
    agent_type: randomFrom<AgentType>(['precision', 'facility', 'assembly']),
    z_score: 1 + Math.random() * 4,
    rate_of_change: Math.random() * 8,
    resolved: Math.random() > 0.6,
    resolved_at: null,
    operator_notes: null,
  };
}

function generateMockAgents(): AegisAgent[] {
  const agents: AegisAgent[] = [
    {
      agent_id: 'agent-precision-001',
      agent_type: 'precision',
      machine_id: 'LITHO-01',
      status: 'active',
      last_heartbeat: new Date().toISOString(),
      detections_24h: 12 + Math.floor(Math.random() * 8),
      uptime_hours: 720 + Math.random() * 100,
      capabilities: ['z_score_analysis', 'rate_of_change', 'thermal_drift_cte'],
      protocol: 'mqtt',
    },
    {
      agent_id: 'agent-facility-001',
      agent_type: 'facility',
      machine_id: 'ETCH-01',
      status: 'active',
      last_heartbeat: new Date().toISOString(),
      detections_24h: 5 + Math.floor(Math.random() * 5),
      uptime_hours: 680 + Math.random() * 100,
      capabilities: ['iso_10816_vibration', 'particle_count', 'cleanroom_monitoring'],
      protocol: 'mqtt',
    },
    {
      agent_id: 'agent-assembly-001',
      agent_type: 'assembly',
      machine_id: 'DEP-01',
      status: 'active',
      last_heartbeat: new Date().toISOString(),
      detections_24h: 3 + Math.floor(Math.random() * 4),
      uptime_hours: 650 + Math.random() * 100,
      capabilities: ['ultrasonic_impedance', 'wire_bond_monitoring', 'loop_height_analysis'],
      protocol: 'mqtt',
    },
  ];
  return agents;
}

function generateMockSummary(incidents: AegisIncident[], agents: AegisAgent[]): SentinelSummary {
  const critical = incidents.filter(i => i.severity === 'critical').length;
  const greenActions = incidents.filter(i => i.action_zone === 'green').length;
  const yellowPending = incidents.filter(i => i.action_zone === 'yellow' && i.action_status === 'pending_approval').length;
  const redAlerts = incidents.filter(i => i.action_zone === 'red').length;

  const machineCounts: Record<string, number> = {};
  incidents.forEach(i => { machineCounts[i.machine_id] = (machineCounts[i.machine_id] || 0) + 1; });
  const topMachines = Object.entries(machineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([machine_id, incident_count]) => ({ machine_id, incident_count }));

  return {
    total_incidents_24h: incidents.length,
    critical_incidents_24h: critical,
    active_agents: agents.filter(a => a.status === 'active').length,
    safety_circuit: {
      green_actions_24h: greenActions,
      yellow_pending: yellowPending,
      red_alerts_24h: redAlerts,
      agents_active: agents.filter(a => a.status === 'active').length,
      agents_total: agents.length,
      last_incident: incidents.length > 0 ? incidents[0] : null,
    },
    recent_incidents: incidents.slice(0, 10),
    top_affected_machines: topMachines,
  };
}

function generateMockKnowledgeGraph(): KnowledgeGraphData {
  return {
    nodes: [
      { data: { id: 'LITHO-01', label: 'LITHO-01', type: 'machine', color: '#00F0FF' } },
      { data: { id: 'ETCH-01', label: 'ETCH-01', type: 'machine', color: '#00F0FF' } },
      { data: { id: 'DEP-01', label: 'DEP-01', type: 'machine', color: '#00F0FF' } },
      { data: { id: 'thermal_runaway', label: 'Thermal Runaway', type: 'failure_type', color: '#FF2E2E' } },
      { data: { id: 'bearing_failure', label: 'Bearing Failure', type: 'failure_type', color: '#FF2E2E' } },
      { data: { id: 'spindle', label: 'Spindle', type: 'component', color: '#FFB020' } },
      { data: { id: 'coolant_system', label: 'Coolant System', type: 'component', color: '#FFB020' } },
      { data: { id: 'emergency_stop', label: 'Emergency Stop', type: 'action', color: '#00FF94' } },
      { data: { id: 'critical', label: 'Critical', type: 'severity', color: '#9CA3AF' } },
      { data: { id: 'high', label: 'High', type: 'severity', color: '#9CA3AF' } },
    ],
    edges: [
      { data: { id: 'e1', source: 'LITHO-01', target: 'thermal_runaway', label: 'has_issue', weight: 3 } },
      { data: { id: 'e2', source: 'ETCH-01', target: 'bearing_failure', label: 'has_issue', weight: 2 } },
      { data: { id: 'e3', source: 'thermal_runaway', target: 'spindle', label: 'affects', weight: 2 } },
      { data: { id: 'e4', source: 'bearing_failure', target: 'coolant_system', label: 'affects', weight: 1 } },
      { data: { id: 'e5', source: 'emergency_stop', target: 'thermal_runaway', label: 'resolves', weight: 3 } },
      { data: { id: 'e6', source: 'critical', target: 'thermal_runaway', label: 'classifies', weight: 2 } },
      { data: { id: 'e7', source: 'high', target: 'bearing_failure', label: 'classifies', weight: 2 } },
      { data: { id: 'e8', source: 'DEP-01', target: 'thermal_runaway', label: 'has_issue', weight: 1 } },
    ],
    stats: {
      node_count: 10,
      edge_count: 8,
      central_concepts: [['thermal_runaway', 0.44], ['LITHO-01', 0.33], ['bearing_failure', 0.33]],
    },
  };
}

// -------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------

export function useAegisSentinel(options: UseAegisSentinelOptions = {}) {
  const { pollingInterval = 10000 } = options;
  const apiAvailable = isApiConfigured();

  const [summary, setSummary] = useState<SentinelSummary | null>(null);
  const [incidents, setIncidents] = useState<AegisIncident[]>([]);
  const [agents, setAgents] = useState<AegisAgent[]>([]);
  const [safetyCircuit, setSafetyCircuit] = useState<SafetyCircuitStatus | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mockInitialized = useRef(false);

  // Initialize mock data or fetch from API
  const fetchData = useCallback(async () => {
    if (!apiAvailable) {
      // Demo mode: generate mock data once, then keep it stable
      if (!mockInitialized.current) {
        const mockIncidents = Array.from({ length: 15 }, (_, i) => generateMockIncident(i))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const mockAgents = generateMockAgents();
        const mockSummary = generateMockSummary(mockIncidents, mockAgents);

        setIncidents(mockIncidents);
        setAgents(mockAgents);
        setSummary(mockSummary);
        setSafetyCircuit(mockSummary.safety_circuit);
        mockInitialized.current = true;
      }
      setLoading(false);
      return;
    }

    try {
      const [summaryData, incidentsData, agentsData, circuitData] = await Promise.all([
        api.getAegisSummary(),
        api.getAegisIncidents({ limit: 50 }),
        api.getAegisAgents(),
        api.getSafetyCircuitStatus(),
      ]);
      setSummary(summaryData);
      setIncidents(incidentsData);
      setAgents(agentsData);
      setSafetyCircuit(circuitData);
      setError(null);
    } catch (err) {
      // Fallback to mock data on API failure
      if (!mockInitialized.current) {
        const mockIncidents = Array.from({ length: 15 }, (_, i) => generateMockIncident(i))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const mockAgents = generateMockAgents();
        const mockSummary = generateMockSummary(mockIncidents, mockAgents);
        setIncidents(mockIncidents);
        setAgents(mockAgents);
        setSummary(mockSummary);
        setSafetyCircuit(mockSummary.safety_circuit);
        mockInitialized.current = true;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch sentinel data');
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!apiAvailable) return;
    const interval = setInterval(fetchData, pollingInterval);
    return () => clearInterval(interval);
  }, [apiAvailable, pollingInterval, fetchData]);

  // Actions
  const approveIncident = useCallback(async (incidentId: string, approved: boolean, notes?: string) => {
    if (!apiAvailable) {
      setIncidents(prev => prev.map(i =>
        i.incident_id === incidentId
          ? { ...i, action_status: approved ? 'approved' as ActionStatus : 'rejected' as ActionStatus, operator_notes: notes || null }
          : i
      ));
      return;
    }
    await api.approveIncident(incidentId, approved, notes);
    fetchData();
  }, [apiAvailable, fetchData]);

  const resolveIncident = useCallback(async (incidentId: string, notes?: string) => {
    if (!apiAvailable) {
      setIncidents(prev => prev.map(i =>
        i.incident_id === incidentId
          ? { ...i, resolved: true, resolved_at: new Date().toISOString(), operator_notes: notes || null }
          : i
      ));
      return;
    }
    await api.resolveIncident(incidentId, notes);
    fetchData();
  }, [apiAvailable, fetchData]);

  const fetchKnowledgeGraph = useCallback(async () => {
    if (!apiAvailable) {
      setKnowledgeGraph(generateMockKnowledgeGraph());
      return;
    }
    try {
      const data = await api.generateKnowledgeGraph();
      setKnowledgeGraph(data);
    } catch {
      setKnowledgeGraph(generateMockKnowledgeGraph());
    }
  }, [apiAvailable]);

  return {
    summary,
    incidents,
    agents,
    safetyCircuit,
    knowledgeGraph,
    loading,
    error,
    approveIncident,
    resolveIncident,
    fetchKnowledgeGraph,
    refresh: fetchData,
  };
}
