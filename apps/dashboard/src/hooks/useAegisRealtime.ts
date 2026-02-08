import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import type { AegisIncident, AegisAgent } from '../types';

interface SafetyCircuitStatus {
  green_actions_24h: number;
  yellow_pending: number;
  red_alerts_24h: number;
  agents_active: number;
  agents_total: number;
}

interface SentinelSummary {
  total_incidents_24h: number;
  critical_incidents_24h: number;
  active_agents: number;
  safety_circuit: SafetyCircuitStatus;
  recent_incidents: AegisIncident[];
  top_affected_machines: Array<{ machine_id: string; incident_count: number }>;
}

interface FacilitySummary {
  total_ffus: number;
  critical_ffus: number;
  avg_pressure_drop_pa: number;
  max_particle_count: number;
  iso_compliant_zones: number;
}

interface AssemblySummary {
  total_bonders: number;
  warning_bonders: number;
  avg_oee_percent: number;
  total_nsop_24h: number;
  avg_bond_time_ms: number;
}

// Demo data for when Supabase returns empty results
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
    protocol: 'SECS/GEM',
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
    protocol: 'Modbus/BACnet',
  },
  {
    agent_id: 'demo-agent-assembly-001',
    agent_type: 'assembly',
    machine_id: 'DEP-01',
    status: 'active',
    last_heartbeat: new Date().toISOString(),
    detections_24h: 3,
    uptime_hours: 650,
    capabilities: ['ultrasonic_impedance', 'wire_bond_monitoring'],
    protocol: 'SECS/GEM',
  },
];

const DEMO_INCIDENTS: AegisIncident[] = [
  {
    incident_id: 'demo-inc-001',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    machine_id: 'LITHO-01',
    severity: 'high',
    incident_type: 'thermal_runaway',
    message: 'HIGH: Thermal runaway detected on LITHO-01 (95.2°C / 75°C max)',
    detected_value: 95.2,
    threshold_value: 75.0,
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
    message: 'WARNING: Elevated temperature on ETCH-01 (82.5°C / 85°C max)',
    detected_value: 82.5,
    threshold_value: 85.0,
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

export function useAegisRealtime() {
  const [incidents, setIncidents] = useState<AegisIncident[]>([]);
  const [agents, setAgents] = useState<AegisAgent[]>([]);
  const [summary, setSummary] = useState<SentinelSummary | null>(null);
  const [facilitySummary, setFacilitySummary] = useState<FacilitySummary | null>(null);
  const [assemblySummary, setAssemblySummary] = useState<AssemblySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Use ref for isDemoMode to avoid stale closures in realtime callbacks
  const isDemoModeRef = useRef(false);
  isDemoModeRef.current = isDemoMode;

  // Track if we ever got real data (prevents flickering back to demo)
  const hasReceivedRealData = useRef(false);

  // Fetch initial data
  const fetchData = useCallback(async (isInitial = false) => {
    try {
      // Only show loading on initial fetch, not on polls/refreshes
      if (isInitial) setLoading(true);

      // Fetch ALL incidents first (not just 24h), then filter
      const { data: allIncidents, error: incidentsError } = await supabase
        .from('aegis_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (incidentsError) {
        // Silently handle error
        throw incidentsError;
      }

      // Fetch agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('aegis_agents')
        .select('*')
        .order('machine_id');

      if (agentsError) {
        // Silently handle error
        throw agentsError;
      }

      // Filter out demo incidents - only keep real "Active incident" entries
      const realIncidents = (allIncidents || []).filter(
        (incident) => !incident.message?.includes('Demo incident')
      );
      
      const hasRealIncidents = realIncidents.length > 0;
      const hasAgents = agentsData && agentsData.length > 0;

      // If NO real data from Supabase, use demo data (only if we never had real data before)
      if (!hasRealIncidents && !hasAgents) {
        if (!hasReceivedRealData.current) {

          setIncidents(DEMO_INCIDENTS);
          setAgents(DEMO_AGENTS);
          setIsDemoMode(true);

          const demoSummary: SentinelSummary = {
            total_incidents_24h: DEMO_INCIDENTS.length,
            critical_incidents_24h: DEMO_INCIDENTS.filter(i => i.severity === 'critical').length,
            active_agents: DEMO_AGENTS.filter(a => a.status === 'active').length,
            safety_circuit: {
              green_actions_24h: DEMO_INCIDENTS.filter(i => i.action_zone === 'green').length,
              yellow_pending: DEMO_INCIDENTS.filter(i => i.action_zone === 'yellow' && !i.resolved).length,
              red_alerts_24h: DEMO_INCIDENTS.filter(i => i.action_zone === 'red').length,
              agents_active: DEMO_AGENTS.filter(a => a.status === 'active').length,
              agents_total: DEMO_AGENTS.length,
            },
            recent_incidents: DEMO_INCIDENTS.slice(0, 10),
            top_affected_machines: calculateTopMachines(DEMO_INCIDENTS),
          };
          setSummary(demoSummary);
        }
        // If we had real data before, keep existing state (don't flash to demo)
        setError(null);
        setLoading(false);
        return;
      }

      // Use REAL data from Supabase - we have actual incidents
      hasReceivedRealData.current = true;

      
      const incidentsData = realIncidents;
      const agentsList = agentsData || [];

      // Filter to last 24h for summary stats
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentIncidents = incidentsData.filter(i => i.created_at >= twentyFourHoursAgo);
      const activeAgents = agentsList.filter(a => a.status === 'active');

      // Try to fetch safety circuit status
      let safetyData: SafetyCircuitStatus | null = null;
      try {
        const { data: rpcData } = await supabase.rpc('get_safety_circuit_status');
        safetyData = rpcData?.[0] || null;
      } catch (e) {

      }

      // Calculate summary
      const summaryData: SentinelSummary = {
        total_incidents_24h: recentIncidents.length,
        critical_incidents_24h: recentIncidents.filter(i => i.severity === 'critical').length,
        active_agents: activeAgents.length,
        safety_circuit: safetyData || {
          green_actions_24h: recentIncidents.filter(i => i.action_zone === 'green').length,
          yellow_pending: recentIncidents.filter(i => i.action_zone === 'yellow' && !i.resolved).length,
          red_alerts_24h: recentIncidents.filter(i => i.action_zone === 'red').length,
          agents_active: activeAgents.length,
          agents_total: agentsList.length,
        },
        recent_incidents: recentIncidents.slice(0, 10),
        top_affected_machines: calculateTopMachines(recentIncidents),
      };

      setIncidents(recentIncidents);
      setAgents(agentsList);
      setSummary(summaryData);
      setIsDemoMode(false);
      setError(null);

      // Try to fetch facility/assembly summaries (optional)
      try {
        const { data: facilityData } = await supabase.rpc('get_facility_summary');
        if (facilityData?.[0]) setFacilitySummary(facilityData[0]);
      } catch (e) { /* ignore */ }

      try {
        const { data: assemblyData } = await supabase.rpc('get_assembly_summary');
        if (assemblyData?.[0]) setAssemblySummary(assemblyData[0]);
      } catch (e) { /* ignore */ }

    } catch (err) {
      // Silently handle API errors
      setError(err instanceof Error ? err : new Error('Failed to fetch Aegis data'));

      // Fall back to demo data on error only if we never had real data
      if (!hasReceivedRealData.current) {
        setIncidents(DEMO_INCIDENTS);
        setAgents(DEMO_AGENTS);
        setIsDemoMode(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time updates (runs once on mount)
  useEffect(() => {
    fetchData(true);

    // Subscribe to incidents
    const incidentsChannel = supabase
      .channel('aegis-incidents-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aegis_incidents',
        },
        (payload) => {
          // Skip demo incidents in realtime updates
          const newIncident = payload.new as AegisIncident;
          if (newIncident.message?.includes('Demo incident')) {
            return;
          }

          // Only update if not in demo mode (use ref to avoid stale closure)
          if (!isDemoModeRef.current) {
            setIncidents((prev) => {
              if (payload.eventType === 'INSERT') {
                return [newIncident, ...prev];
              }
              if (payload.eventType === 'UPDATE') {
                return prev.map((item) =>
                  item.incident_id === newIncident.incident_id ? newIncident : item
                );
              }
              return prev;
            });

            // Refresh summary
            fetchData();
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to agents
    const agentsChannel = supabase
      .channel('aegis-agents-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aegis_agents',
        },
        (payload) => {


          if (!isDemoModeRef.current) {
            setAgents((prev) => {
              if (payload.eventType === 'INSERT') {
                return [...prev, payload.new as AegisAgent];
              }
              if (payload.eventType === 'UPDATE') {
                return prev.map((item) =>
                  item.agent_id === (payload.new as AegisAgent).agent_id
                    ? (payload.new as AegisAgent)
                    : item
                );
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    // Refresh every 30 seconds as fallback
    const interval = setInterval(() => fetchData(), 30000);

    return () => {
      supabase.removeChannel(incidentsChannel);
      supabase.removeChannel(agentsChannel);
      clearInterval(interval);
    };
  }, [fetchData]);

  const approveIncident = useCallback(async (incidentId: string, approved: boolean, notes?: string) => {
    if (isDemoModeRef.current) {
      setIncidents(prev => prev.map(i =>
        i.incident_id === incidentId
          ? { ...i, action_status: approved ? 'approved' : 'rejected', resolved: true, resolved_at: new Date().toISOString(), operator_notes: notes || null }
          : i
      ));
      return;
    }

    const { error } = await supabase
      .from('aegis_incidents')
      .update({
        action_status: approved ? 'approved' : 'rejected',
        operator_notes: notes,
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('incident_id', incidentId);

    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  const resolveIncident = useCallback(async (incidentId: string, notes?: string) => {
    if (isDemoModeRef.current) {
      setIncidents(prev => prev.map(i =>
        i.incident_id === incidentId
          ? { ...i, resolved: true, resolved_at: new Date().toISOString(), operator_notes: notes || null }
          : i
      ));
      return;
    }

    const { error } = await supabase
      .from('aegis_incidents')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        operator_notes: notes,
      })
      .eq('incident_id', incidentId);

    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  return {
    incidents,
    agents,
    summary,
    facilitySummary,
    assemblySummary,
    loading,
    error,
    isConnected,
    isDemoMode,
    approveIncident,
    resolveIncident,
    refresh: fetchData,
  };
}

function calculateTopMachines(incidents: AegisIncident[]): Array<{ machine_id: string; incident_count: number }> {
  const counts = new Map<string, number>();
  
  incidents.forEach((incident) => {
    const count = counts.get(incident.machine_id) || 0;
    counts.set(incident.machine_id, count + 1);
  });

  return Array.from(counts.entries())
    .map(([machine_id, incident_count]) => ({ machine_id, incident_count }))
    .sort((a, b) => b.incident_count - a.incident_count)
    .slice(0, 5);
}
