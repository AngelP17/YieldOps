import { useRef, useCallback, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { IconMaximize, IconRefresh } from '@tabler/icons-react';
import type { KnowledgeGraphData } from '../../types';

interface KnowledgeGraphVizProps {
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

export function KnowledgeGraphViz({ data, onGenerate, loading }: KnowledgeGraphVizProps) {
  const fgRef = useRef<any>(null);
  const hasZoomedRef = useRef(false);

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
    if (fgRef.current && !hasZoomedRef.current) {
      fgRef.current.zoomToFit(400);
      hasZoomedRef.current = true;
    }
  }, []);
  
  // Reset zoom flag when data changes
  useEffect(() => {
    hasZoomedRef.current = false;
  }, [data]);

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const fontSize = 10 / globalScale;
    const nodeRadius = node.type === 'machine' ? 6 : node.type === 'failure_type' ? 5 : 4;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Label
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#475569';
    ctx.fillText(node.label, node.x || 0, (node.y || 0) + nodeRadius + 2);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Knowledge Graph</h3>
            <p className="text-xs text-slate-500">
              {data.stats.node_count} nodes, {data.stats.edge_count} edges
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              Regenerate
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-2 border-b border-slate-50 flex flex-wrap items-center gap-3">
        {[
          { label: 'Machine', color: '#00F0FF' },
          { label: 'Failure', color: '#FF2E2E' },
          { label: 'Component', color: '#FFB020' },
          { label: 'Action', color: '#00FF94' },
          { label: 'Severity', color: '#9CA3AF' },
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
          cooldownTicks={100}
          onEngineStop={handleZoomToFit}
          enableZoomInteraction={true}
          enableNodeDrag={true}
          width={undefined}
          height={350}
        />
      </div>

      {/* Central Concepts */}
      {data.stats.central_concepts.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Central Concepts</p>
          <div className="flex flex-wrap gap-1.5">
            {data.stats.central_concepts.map(([concept, score]) => (
              <span
                key={concept}
                className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-medium rounded"
              >
                {concept.replace(/_/g, ' ')} ({(score as number).toFixed(2)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
