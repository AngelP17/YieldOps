import { useState, useEffect, useCallback } from 'react';
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

export function useAegisRealtime() {
  const [incidents, setIncidents] = useState<AegisIncident[]>([]);
  const [agents, setAgents] = useState<AegisAgent[]>([]);
  const [summary, setSummary] = useState<SentinelSummary | null>(null);
  const [facilitySummary, setFacilitySummary] = useState<FacilitySummary | null>(null);
  const [assemblySummary, setAssemblySummary] = useState<AssemblySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch incidents from last 24 hours
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('aegis_incidents')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (incidentsError) throw incidentsError;
      
      // Fetch agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('aegis_agents')
        .select('*')
        .order('machine_id');

      if (agentsError) throw agentsError;

      // Fetch safety circuit status
      const { data: safetyData, error: safetyError } = await supabase
        .rpc('get_safety_circuit_status');

      if (safetyError) throw safetyError;

      // Fetch facility summary (Front-End Fab)
      const { data: facilityData, error: facilityError } = await supabase
        .rpc('get_facility_summary');

      if (facilityError && facilityError.code !== '42883') { // Function might not exist yet
        console.warn('Facility summary not available:', facilityError);
      }

      // Fetch assembly summary (Back-End Packaging)
      const { data: assemblyData, error: assemblyError } = await supabase
        .rpc('get_assembly_summary');

      if (assemblyError && assemblyError.code !== '42883') { // Function might not exist yet
        console.warn('Assembly summary not available:', assemblyError);
      }

      // Calculate summary
      const recentIncidents = incidentsData || [];
      const activeAgents = (agentsData || []).filter(a => a.status === 'active');
      
      const summaryData: SentinelSummary = {
        total_incidents_24h: recentIncidents.length,
        critical_incidents_24h: recentIncidents.filter(i => i.severity === 'critical').length,
        active_agents: activeAgents.length,
        safety_circuit: safetyData?.[0] || {
          green_actions_24h: recentIncidents.filter(i => i.action_zone === 'green').length,
          yellow_pending: recentIncidents.filter(i => i.action_zone === 'yellow' && !i.resolved).length,
          red_alerts_24h: recentIncidents.filter(i => i.action_zone === 'red').length,
          agents_active: activeAgents.length,
          agents_total: (agentsData || []).length,
        },
        recent_incidents: recentIncidents.slice(0, 10),
        top_affected_machines: calculateTopMachines(recentIncidents),
      };

      setIncidents(recentIncidents);
      setAgents(agentsData || []);
      setSummary(summaryData);
      
      if (facilityData?.[0]) {
        setFacilitySummary(facilityData[0]);
      }
      
      if (assemblyData?.[0]) {
        setAssemblySummary(assemblyData[0]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching Aegis data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch Aegis data'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    fetchData();

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
          console.log('Aegis incident update:', payload);
          
          setIncidents((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as AegisIncident, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((item) =>
                item.incident_id === (payload.new as AegisIncident).incident_id
                  ? (payload.new as AegisIncident)
                  : item
              );
            }
            return prev;
          });
          
          // Refresh summary
          fetchData();
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
          console.log('Aegis agent update:', payload);
          
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
      )
      .subscribe();

    // Refresh every 30 seconds as fallback
    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(incidentsChannel);
      supabase.removeChannel(agentsChannel);
      clearInterval(interval);
    };
  }, [fetchData]);

  const approveIncident = useCallback(async (incidentId: string, approved: boolean, notes?: string) => {
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
