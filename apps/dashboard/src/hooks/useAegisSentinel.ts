import { useState, useEffect, useCallback } from 'react';
import { api, isApiConfigured } from '../services/apiClient';
import type {
  AegisIncident,
  AegisAgent,
  SafetyCircuitStatus,
  SentinelSummary,
  KnowledgeGraphData,
  ActionStatus,
} from '../types';

interface UseAegisSentinelOptions {
  pollingInterval?: number;
}

// Demo data for when API is unavailable - this is static "sample" data, not random
const DEMO_INCIDENTS: AegisIncident[] = [
  {
    incident_id: 'demo-inc-001',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    machine_id: 'LITHO-01',
    severity: 'high',
    incident_type: 'thermal_runaway',
    message: 'HIGH: Thermal runaway detected on LITHO-01 (95.2C)',
    detected_value: 95.2,
    threshold_value: 95.0,
    action_taken: 'reduce_thermal_load',
    action_status: 'pending_approval',
    action_zone: 'yellow',
    agent_type: 'precision',
    z_score: 3.2,
    rate_of_change: 5.5,
    resolved: false,
    resolved_at: null,
    operator_notes: null,
  },
  {
    incident_id: 'demo-inc-002',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    machine_id: 'ETCH-01',
    severity: 'medium',
    incident_type: 'elevated_temperature',
    message: 'WARNING: Elevated temperature on ETCH-01 (82.5C)',
    detected_value: 82.5,
    threshold_value: 80.0,
    action_taken: 'increase_coolant',
    action_status: 'auto_executed',
    action_zone: 'green',
    agent_type: 'facility',
    z_score: 2.8,
    rate_of_change: 2.1,
    resolved: true,
    resolved_at: new Date(Date.now() - 3600000).toISOString(),
    operator_notes: 'Coolant increased automatically',
  },
];

const DEMO_AGENTS: AegisAgent[] = [
  {
    agent_id: 'demo-agent-precision-001',
    agent_type: 'precision',
    machine_id: 'LITHO-01',
    status: 'active',
    last_heartbeat: new Date().toISOString(),
    detections_24h: 12,
    uptime_hours: 720,
    capabilities: ['z_score_analysis', 'rate_of_change', 'thermal_drift_cte'],
    protocol: 'mqtt',
  },
  {
    agent_id: 'demo-agent-facility-001',
    agent_type: 'facility',
    machine_id: 'ETCH-01',
    status: 'active',
    last_heartbeat: new Date().toISOString(),
    detections_24h: 5,
    uptime_hours: 680,
    capabilities: ['iso_10816_vibration', 'particle_count', 'cleanroom_monitoring'],
    protocol: 'mqtt',
  },
  {
    agent_id: 'demo-agent-assembly-001',
    agent_type: 'assembly',
    machine_id: 'DEP-01',
    status: 'active',
    last_heartbeat: new Date().toISOString(),
    detections_24h: 3,
    uptime_hours: 650,
    capabilities: ['ultrasonic_impedance', 'wire_bond_monitoring', 'loop_height_analysis'],
    protocol: 'mqtt',
  },
];

const DEMO_SAFETY_CIRCUIT: SafetyCircuitStatus = {
  green_actions_24h: 1,
  yellow_pending: 1,
  red_alerts_24h: 0,
  agents_active: 3,
  agents_total: 3,
  last_incident: DEMO_INCIDENTS[0],
};

const DEMO_SUMMARY: SentinelSummary = {
  total_incidents_24h: 2,
  critical_incidents_24h: 0,
  active_agents: 3,
  safety_circuit: DEMO_SAFETY_CIRCUIT,
  recent_incidents: DEMO_INCIDENTS,
  top_affected_machines: [
    { machine_id: 'LITHO-01', incident_count: 1 },
    { machine_id: 'ETCH-01', incident_count: 1 },
  ],
};

const DEMO_KNOWLEDGE_GRAPH: KnowledgeGraphData = {
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
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Track whether we've ever received real data (prevents flickering back to demo)
  const [hasReceivedRealData, setHasReceivedRealData] = useState(false);

  // Fetch data from API or use demo data
  const fetchData = useCallback(async (isInitial = false) => {
    if (!apiAvailable) {
      // Demo mode: use static demo data
      setIncidents(DEMO_INCIDENTS);
      setAgents(DEMO_AGENTS);
      setSummary(DEMO_SUMMARY);
      setSafetyCircuit(DEMO_SAFETY_CIRCUIT);
      setIsDemoMode(true);
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial fetch, not on polls
    if (isInitial) setLoading(true);

    try {
      const [summaryData, incidentsData, agentsData, circuitData] = await Promise.all([
        api.getAegisSummary(),
        api.getAegisIncidents({ limit: 50 }),
        api.getAegisAgents(),
        api.getSafetyCircuitStatus(),
      ]);

      // Filter out demo incidents from API response
      const realIncidents = (incidentsData || []).filter(
        (incident) => !incident.message?.includes('Demo incident')
      );

      // Check if API returned real data (even empty arrays mean the API is working)
      const apiResponded = Array.isArray(agentsData) || Array.isArray(incidentsData);
      const hasRealData = (agentsData && agentsData.length > 0) || (realIncidents.length > 0);

      if (apiResponded) {
        // API is working - check if we have real data
        if (hasRealData) {
          // Use real data from API
          console.log(`[Aegis API] Using real data: ${realIncidents.length} incidents, ${agentsData?.length || 0} agents`);
          setSummary(summaryData);
          setIncidents(realIncidents);
          setAgents(agentsData || []);
          setSafetyCircuit(circuitData);
          setHasReceivedRealData(true);
          setIsDemoMode(false);
        } else if (!hasReceivedRealData) {
          // No real data yet, use demo fallback
          console.log('[Aegis API] No real data from API, using demo fallback');
          setIncidents(DEMO_INCIDENTS);
          setAgents(DEMO_AGENTS);
          setSummary(DEMO_SUMMARY);
          setSafetyCircuit(DEMO_SAFETY_CIRCUIT);
          setIsDemoMode(true);
        }
        // If hasReceivedRealData but this poll returned empty, keep existing data
      }
      // If hasReceivedRealData but this poll returned empty, keep existing data
      setError(null);
    } catch (err) {
      console.error('Error fetching sentinel data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sentinel data');
      // Only fall back to demo if we've never had real data
      if (!hasReceivedRealData) {
        setIncidents(DEMO_INCIDENTS);
        setAgents(DEMO_AGENTS);
        setSummary(DEMO_SUMMARY);
        setSafetyCircuit(DEMO_SAFETY_CIRCUIT);
        setIsDemoMode(true);
      }
    } finally {
      setLoading(false);
    }
  }, [apiAvailable, hasReceivedRealData]);

  // Initial fetch
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!apiAvailable) return;
    const interval = setInterval(fetchData, pollingInterval);
    return () => clearInterval(interval);
  }, [apiAvailable, pollingInterval, fetchData]);

  // Actions - these will update Supabase when API is available
  const approveIncident = useCallback(async (incidentId: string, approved: boolean, notes?: string) => {
    if (isDemoMode) {
      // Update local state only in demo mode
      setIncidents(prev => prev.map(i =>
        i.incident_id === incidentId
          ? { ...i, action_status: approved ? 'approved' as ActionStatus : 'rejected' as ActionStatus, operator_notes: notes || null }
          : i
      ));
      return;
    }
    
    try {
      await api.approveIncident(incidentId, approved, notes);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve incident');
      throw err;
    }
  }, [isDemoMode, fetchData]);

  const resolveIncident = useCallback(async (incidentId: string, notes?: string) => {
    if (isDemoMode) {
      setIncidents(prev => prev.map(i =>
        i.incident_id === incidentId
          ? { ...i, resolved: true, resolved_at: new Date().toISOString(), operator_notes: notes || null }
          : i
      ));
      return;
    }
    
    try {
      await api.resolveIncident(incidentId, notes);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve incident');
      throw err;
    }
  }, [isDemoMode, fetchData]);

  const fetchKnowledgeGraph = useCallback(async () => {
    if (isDemoMode) {
      setKnowledgeGraph(DEMO_KNOWLEDGE_GRAPH);
      return;
    }
    
    try {
      const data = await api.generateKnowledgeGraph();
      setKnowledgeGraph(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate knowledge graph');
      setKnowledgeGraph(DEMO_KNOWLEDGE_GRAPH);
    }
  }, [isDemoMode]);

  return {
    summary,
    incidents,
    agents,
    safetyCircuit,
    knowledgeGraph,
    loading,
    error,
    isDemoMode,
    approveIncident,
    resolveIncident,
    fetchKnowledgeGraph,
    refresh: fetchData,
  };
}
