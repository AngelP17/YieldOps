import { useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { Machine } from '../../types';

interface MachineTopologyProps {
  machines: Machine[];
  selectedMachineId?: string | null;
  onSelectMachine: (machine: Machine) => void;
  vmStatuses?: Record<string, { has_prediction: boolean; needs_correction?: boolean }>;
}

interface TopologyNode {
  id: string;
  name: string;
  type: 'zone' | 'machine';
  status?: string;
  machineType?: string;
  efficiency?: number;
  val: number;
  color: string;
  x?: number;
  y?: number;
}

interface TopologyLink {
  source: string;
  target: string;
  value: number;
}

const ZONE_COLORS: Record<string, string> = {
  'ZONE_A': '#3B82F6', // Blue - Lithography
  'ZONE_B': '#8B5CF6', // Purple - Etching
  'ZONE_C': '#10B981', // Emerald - Deposition
  'ZONE_D': '#F59E0B', // Amber - Inspection
  'ZONE_E': '#06B6D4', // Cyan - Cleaning
  'ZONE_F': '#EF4444', // Red - Expansion
  'ZONE_G': '#EC4899', // Pink - Expansion
  'ZONE_H': '#84CC16', // Lime - Expansion
};

const STATUS_COLORS: Record<string, string> = {
  'RUNNING': '#10B981',
  'IDLE': '#F59E0B',
  'DOWN': '#EF4444',
  'MAINTENANCE': '#6B7280',
};

export function MachineTopology({ machines, selectedMachineId, onSelectMachine, vmStatuses }: MachineTopologyProps) {
  const fgRef = useRef<any>(null);

  const { nodes, links } = useMemo(() => {
    const zoneNodes: TopologyNode[] = [];
    const machineNodes: TopologyNode[] = [];
    const topologyLinks: TopologyLink[] = [];

    // Group machines by zone
    const machinesByZone = machines.reduce((acc, m) => {
      if (!acc[m.location_zone]) acc[m.location_zone] = [];
      acc[m.location_zone].push(m);
      return acc;
    }, {} as Record<string, Machine[]>);

    // Create zone nodes and machine nodes
    Object.entries(machinesByZone).forEach(([zone, zoneMachines]) => {
      // Zone node (larger, central)
      zoneNodes.push({
        id: zone,
        name: zone.replace('_', ' '),
        type: 'zone',
        val: 20,
        color: ZONE_COLORS[zone] || '#64748B',
      });

      // Machine nodes connected to zone
      zoneMachines.forEach((machine) => {
        const vmNeedsCorrection = vmStatuses?.[machine.machine_id]?.needs_correction;
        let nodeColor = STATUS_COLORS[machine.status] || '#64748B';
        
        // If VM shows needs correction, add visual indicator
        if (vmNeedsCorrection) {
          nodeColor = '#F97316'; // Orange warning
        }

        machineNodes.push({
          id: machine.machine_id,
          name: machine.name,
          type: 'machine',
          status: machine.status,
          machineType: machine.type,
          efficiency: machine.efficiency_rating,
          val: 8,
          color: nodeColor,
        });

        topologyLinks.push({
          source: zone,
          target: machine.machine_id,
          value: 2,
        });
      });
    });

    return { nodes: [...zoneNodes, ...machineNodes], links: topologyLinks };
  }, [machines, vmStatuses]);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    if (node.type === 'machine') {
      const machine = machines.find(m => m.machine_id === node.id);
      if (machine) onSelectMachine(machine);
    }
  }, [machines, onSelectMachine]);

  const nodeCanvasObject = useCallback((node: TopologyNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = node.type === 'zone' ? 12 / globalScale : 10 / globalScale;
    ctx.font = `${node.type === 'zone' ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
    
    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, node.val, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Draw border for selected machine
    if (node.id === selectedMachineId) {
      ctx.strokeStyle = '#1E40AF';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    // Draw status indicator for machines
    if (node.type === 'machine' && node.status) {
      ctx.beginPath();
      ctx.arc((node.x || 0) + node.val * 0.7, (node.y || 0) - node.val * 0.7, 3 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = STATUS_COLORS[node.status] || '#6B7280';
      ctx.fill();
    }

    // Draw label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = node.type === 'zone' ? '#1E293B' : '#475569';
    ctx.fillText(label, node.x || 0, (node.y || 0) + node.val + fontSize);
  }, [selectedMachineId]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Machine Topology</h3>
          <p className="text-xs text-slate-500">Zones and machine relationships</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Running</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">Idle</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-slate-500">Down</span>
          </div>
        </div>
      </div>
      
      <div className="h-[400px]">
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
          linkColor={() => '#CBD5E1'}
          linkWidth={1}
          onNodeClick={handleNodeClick}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          warmupTicks={100}
          cooldownTicks={50}
        />
      </div>
    </div>
  );
}
