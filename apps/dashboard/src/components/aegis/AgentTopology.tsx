import { useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { AegisAgent } from '../../types';

interface AgentTopologyProps {
  agents: AegisAgent[];
  incidents: Array<{
    incident_id: string;
    machine_id?: string;
    agent_id?: string;
    severity: string;
    action_zone: string;
  }>;
  onSelectAgent?: (agent: AegisAgent) => void;
}

interface TopologyNode {
  id: string;
  name: string;
  type: 'sentinel' | 'agent' | 'machine' | 'incident';
  status?: string;
  agentType?: string;
  protocol?: string;
  severity?: string;
  zone?: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
}

interface TopologyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

const AGENT_COLORS: Record<string, string> = {
  'facility': '#3B82F6',    // Blue
  'precision': '#8B5CF6',   // Purple
  'assembly': '#10B981',    // Emerald
};

const PROTOCOL_COLORS: Record<string, string> = {
  'Modbus': '#F59E0B',
  'MQTT': '#06B6D4',
  'FOCAS': '#EC4899',
  'SECS/GEM': '#84CC16',
  'OPC-UA': '#EF4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  'critical': '#EF4444',
  'high': '#F97316',
  'medium': '#F59E0B',
  'low': '#10B981',
};

const ZONE_COLORS: Record<string, string> = {
  'green': '#10B981',
  'yellow': '#F59E0B',
  'red': '#EF4444',
};

export function AgentTopology({ agents, incidents, onSelectAgent }: AgentTopologyProps) {
  const fgRef = useRef<any>(null);

  const { nodes, links } = useMemo(() => {
    const topologyNodes: TopologyNode[] = [];
    const topologyLinks: TopologyLink[] = [];

    // Central Sentinel node
    topologyNodes.push({
      id: 'sentinel-core',
      name: 'Aegis Sentinel',
      type: 'sentinel',
      val: 25,
      color: '#1E40AF',
    });

    // Agent nodes connected to sentinel
    agents.forEach((agent) => {
      topologyNodes.push({
        id: agent.agent_id,
        name: `${agent.agent_type} Agent`,
        type: 'agent',
        status: agent.status,
        agentType: agent.agent_type,
        protocol: agent.protocol,
        val: 15,
        color: AGENT_COLORS[agent.agent_type] || '#64748B',
      });

      topologyLinks.push({
        source: 'sentinel-core',
        target: agent.agent_id,
        value: 3,
        color: agent.status === 'online' ? '#10B981' : '#EF4444',
      });

      // Add protocol indicator node
      const protocolNodeId = `${agent.agent_id}-protocol`;
      topologyNodes.push({
        id: protocolNodeId,
        name: agent.protocol,
        type: 'agent',
        val: 8,
        color: PROTOCOL_COLORS[agent.protocol] || '#94A3B8',
      });

      topologyLinks.push({
        source: agent.agent_id,
        target: protocolNodeId,
        value: 1,
        color: '#CBD5E1',
      });
    });

    // Add incident nodes linked to agents
    incidents.slice(0, 10).forEach((incident) => {
      const incidentNodeId = `incident-${incident.incident_id}`;
      topologyNodes.push({
        id: incidentNodeId,
        name: incident.incident_id.split('-').pop() || '',
        type: 'incident',
        severity: incident.severity,
        zone: incident.action_zone,
        val: 6,
        color: SEVERITY_COLORS[incident.severity] || '#6B7280',
      });

      // Link to agent if available, otherwise to sentinel core
      const targetId = incident.agent_id && agents.find(a => a.agent_id === incident.agent_id)
        ? incident.agent_id
        : 'sentinel-core';

      topologyLinks.push({
        source: targetId,
        target: incidentNodeId,
        value: 1,
        color: ZONE_COLORS[incident.action_zone] || '#94A3B8',
      });
    });

    return { nodes: topologyNodes, links: topologyLinks };
  }, [agents, incidents]);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    if (node.type === 'agent' && onSelectAgent) {
      const agent = agents.find(a => a.agent_id === node.id);
      if (agent) onSelectAgent(agent);
    }
  }, [agents, onSelectAgent]);

  const nodeCanvasObject = useCallback((node: TopologyNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = node.type === 'sentinel' ? 14 / globalScale : 
                     node.type === 'agent' ? 11 / globalScale : 9 / globalScale;
    ctx.font = `${node.type === 'sentinel' || node.type === 'agent' ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
    
    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, node.val, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Draw border for agents
    if (node.type === 'agent') {
      ctx.strokeStyle = node.status === 'online' ? '#10B981' : '#EF4444';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw pulse effect for critical incidents
    if (node.type === 'incident' && node.severity === 'critical') {
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, node.val + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = node.type === 'sentinel' ? '#1E293B' : 
                    node.type === 'agent' ? '#334155' : '#64748B';
    
    // For larger nodes, put label inside; for smaller, put below
    if (node.val > 10) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, node.x || 0, node.y || 0);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillText(label, node.x || 0, (node.y || 0) + node.val + fontSize);
    }
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sentinel Topology</h3>
          <p className="text-xs text-slate-500">Agent hierarchy and incident relationships</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-slate-500">Facility</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-slate-500">Precision</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Assembly</span>
          </div>
        </div>
      </div>
      
      <div className="h-[350px]">
        <ForceGraph2D
          ref={fgRef}
          graphData={{ nodes, links }}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: TopologyNode, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, node.val, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor={(link: TopologyLink) => link.color || '#CBD5E1'}
          linkWidth={(link: TopologyLink) => link.value}
          onNodeClick={handleNodeClick}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          warmupTicks={100}
          cooldownTicks={50}
        />
      </div>
      
      {/* Legend */}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-xs">
        <span className="text-slate-400">Safety Zones:</span>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-500">Green</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-slate-500">Yellow</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-slate-500">Red</span>
        </div>
      </div>
    </div>
  );
}
