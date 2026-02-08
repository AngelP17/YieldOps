import { useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { IconMaximize, IconRefresh, IconCpu, IconAlertTriangle } from '@tabler/icons-react';
import type { KnowledgeGraphData } from '../../types';

interface SystemKnowledgeGraphVizProps {
  data: KnowledgeGraphData;
  onGenerate: () => void;
  loading?: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  weight: number;
}

export function SystemKnowledgeGraphViz({
  data,
  onGenerate,
  loading
}: SystemKnowledgeGraphVizProps) {
  const fgRef = useRef<any>(null);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = data.nodes.map(n => ({
      id: n.data.id,
      label: n.data.label,
      type: n.data.type,
      color: n.data.color,
    }));

    const links: GraphLink[] = data.edges.map(e => ({
      source: e.data.source,
      target: e.data.target,
      label: e.data.label,
      weight: e.data.weight,
    }));

    return { nodes, links };
  }, [data]);

  const handleZoomToFit = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400);
    }
  }, []);

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isMachine = node.type?.startsWith('machine_');
    const isJob = node.type?.startsWith('job_');
    const isZone = node.type === 'zone';
    const isHub = node.type === 'system_hub';
    
    // Node radius based on type
    let nodeRadius = 4;
    if (isHub) nodeRadius = 10;
    else if (isMachine) nodeRadius = 6;
    else if (isJob) nodeRadius = 5;
    else if (isZone) nodeRadius = 7;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Special styling for system hub
    if (isHub) {
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
      
      // Inner ring for hub
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius - 3, 0, 2 * Math.PI);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Label
    const fontSize = isHub ? 12 / globalScale : 10 / globalScale;
    ctx.font = `${isHub ? '600' : '400'} ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isHub ? '#1E293B' : '#475569';
    
    // Truncate long labels
    let label = node.label;
    if (label.length > 20 && !isMachine && !isHub) {
      label = label.substring(0, 17) + '...';
    }
    
    ctx.fillText(label, node.x || 0, (node.y || 0) + nodeRadius + 2);
  }, []);

  // Get stats
  const machineCount = data.nodes.filter(n => n.data.type?.startsWith('machine_')).length;
  const runningCount = data.nodes.filter(n => n.data.type === 'machine_running').length;
  const downCount = data.nodes.filter(n => n.data.type === 'machine_down').length;
  const jobCount = data.nodes.filter(n => n.data.type?.startsWith('job_')).length;
  const zoneCount = data.nodes.filter(n => n.data.type === 'zone').length;

  // Zone utilization
  const zoneSummary = (data.stats as any)?.zone_summary || {};
  const bottlenecks = (data.stats as any)?.bottlenecks || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Graph Stats Bar */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500">
            {data.stats.node_count} nodes, {data.stats.edge_count} edges
            {machineCount > 0 && ` • ${machineCount} machines`}
            {jobCount > 0 && ` • ${jobCount} active jobs`}
            {zoneCount > 0 && ` • ${zoneCount} zones`}
          </p>
          
          <div className="flex items-center gap-2">
            {/* Status Indicators */}
            <div className="flex items-center gap-2 mr-2">
              {runningCount > 0 && (
                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded">
                  {runningCount} Running
                </span>
              )}
              {downCount > 0 && (
                <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-medium rounded flex items-center gap-1">
                  <IconAlertTriangle className="w-3 h-3" />
                  {downCount} Down
                </span>
              )}
            </div>
            
            <button
              onClick={handleZoomToFit}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Zoom to fit"
            >
              <IconMaximize className="w-4 h-4" />
            </button>
            <button
              onClick={onGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              <IconRefresh className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-2 border-b border-slate-50 flex flex-wrap items-center gap-3">
        {[
          { label: 'Running', color: '#10B981' },
          { label: 'Idle', color: '#F59E0B' },
          { label: 'Down', color: '#EF4444' },
          { label: 'Maintenance', color: '#6B7280' },
          { label: 'Zone', color: '#3B82F6' },
          { label: 'Job', color: '#00F0FF' },
          { label: 'Type', color: '#8B5CF6' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] font-medium text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Graph Canvas */}
      <div className="h-[350px] bg-slate-50/50">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, 8, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor={() => '#CBD5E1'}
          linkWidth={(link: GraphLink) => Math.min(link.weight, 4)}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkLabel={(link: GraphLink) => link.label.replace(/_/g, ' ')}
          cooldownTicks={80}
          onEngineStop={handleZoomToFit}
          width={undefined}
          height={350}
        />
      </div>

      {/* Zone Utilization */}
      {Object.keys(zoneSummary).length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Zone Utilization</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(zoneSummary).map(([zone, stats]) => {
              const utilization = (stats as any).utilization || 0;
              return (
                <div key={zone} className="bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{zone}</span>
                    <span className={`text-[10px] font-semibold ${
                      utilization > 0.7 ? 'text-emerald-600' :
                      utilization > 0.4 ? 'text-amber-600' :
                      'text-rose-600'
                    }`}>
                      {(utilization * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        utilization > 0.7 ? 'bg-emerald-500' :
                        utilization > 0.4 ? 'bg-amber-500' :
                        'bg-rose-500'
                      }`}
                      style={{ width: `${utilization * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {(stats as any).running || 0}/{(stats as any).machine_count || 0} active
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/30">
          <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <IconAlertTriangle className="w-3 h-3" />
            Potential Bottlenecks
          </p>
          <div className="flex flex-wrap gap-2">
            {bottlenecks.slice(0, 3).map((b: any) => (
              <span
                key={b.machine_id}
                className="px-2 py-1 bg-white border border-amber-200 text-amber-800 text-[10px] font-medium rounded flex items-center gap-1"
              >
                {b.label}
                <span className="text-amber-500">
                  {(b.centrality * 100).toFixed(0)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
