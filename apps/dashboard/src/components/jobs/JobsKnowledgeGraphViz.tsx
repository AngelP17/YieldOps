import { useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { IconMaximize, IconRefresh, IconFilter } from '@tabler/icons-react';
import type { KnowledgeGraphData } from '../../types';

interface JobsKnowledgeGraphVizProps {
  data: KnowledgeGraphData;
  onGenerate: () => void;
  onFilterChange?: (filter: { includeCompleted: boolean; customerFilter: string }) => void;
  loading?: boolean;
  customers?: string[];
  currentFilter?: { includeCompleted: boolean; customerFilter: string };
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

export function JobsKnowledgeGraphViz({
  data,
  onGenerate,
  onFilterChange,
  loading,
  customers = [],
  currentFilter = { includeCompleted: true, customerFilter: '' }
}: JobsKnowledgeGraphVizProps) {
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

  const handleToggleCompleted = () => {
    onFilterChange?.({
      ...currentFilter,
      includeCompleted: !currentFilter.includeCompleted
    });
  };

  const handleCustomerChange = (customer: string) => {
    onFilterChange?.({
      ...currentFilter,
      customerFilter: customer === 'ALL' ? '' : customer
    });
  };

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isJob = node.type === 'job' || node.type === 'job_hot';
    const isCustomer = node.type === 'customer';
    const isMachine = node.type === 'machine';
    
    // Node radius based on type
    let nodeRadius = 4;
    if (isJob) nodeRadius = node.type === 'job_hot' ? 7 : 5;
    else if (isCustomer) nodeRadius = 6;
    else if (isMachine) nodeRadius = 6;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Border for hot lots
    if (node.type === 'job_hot') {
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Label
    const fontSize = 10 / globalScale;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#475569';
    
    // Truncate long labels
    let label = node.label;
    if (label.length > 15 && !isJob && !isCustomer) {
      label = label.substring(0, 12) + '...';
    }
    
    ctx.fillText(label, node.x || 0, (node.y || 0) + nodeRadius + 2);
  }, []);

  // Get stats
  const jobCount = data.nodes.filter(n => n.data.type === 'job' || n.data.type === 'job_hot').length;
  const hotLotCount = data.nodes.filter(n => n.data.type === 'job_hot').length;
  const customerCount = data.nodes.filter(n => n.data.type === 'customer').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Jobs Knowledge Graph
              {hotLotCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-semibold rounded-full">
                  {hotLotCount} Hot
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              {data.stats.node_count} nodes, {data.stats.edge_count} edges
              {jobCount > 0 && ` • ${jobCount} jobs`}
              {customerCount > 0 && ` • ${customerCount} customers`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter Controls */}
            {onFilterChange && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={handleToggleCompleted}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    currentFilter.includeCompleted
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={currentFilter.includeCompleted ? 'Hide completed jobs' : 'Show completed jobs'}
                >
                  <IconFilter className="w-3 h-3" />
                  {currentFilter.includeCompleted ? 'All' : 'Active'}
                </button>
                
                {customers.length > 0 && (
                  <select
                    value={currentFilter.customerFilter || 'ALL'}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="ALL">All Customers</option>
                    {customers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
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
          { label: 'Job', color: '#3B82F6' },
          { label: 'Hot Lot', color: '#F43F5E' },
          { label: 'Machine', color: '#00F0FF' },
          { label: 'Customer', color: '#8B5CF6' },
          { label: 'Recipe', color: '#10B981' },
          { label: 'Status', color: '#F59E0B' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span 
              className={`w-2.5 h-2.5 rounded-full ${item.label === 'Hot Lot' ? 'ring-2 ring-rose-200' : ''}`} 
              style={{ backgroundColor: item.color }} 
            />
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

      {/* Stats & Insights */}
      {(data.stats as any).customer_workload && Object.keys((data.stats as any).customer_workload).length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Customer Workload</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries((data.stats as any).customer_workload)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 5)
              .map(([customer, count]) => (
                <span
                  key={customer}
                  className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] font-medium rounded flex items-center gap-1"
                >
                  {customer}
                  <span className="bg-purple-100 px-1 rounded-full">{count as number}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Job Clusters */}
      {(data.stats as any).job_clusters && Object.keys((data.stats as any).job_clusters).length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Status Distribution</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries((data.stats as any).job_clusters)
              .map(([status, jobs]) => (
                <span
                  key={status}
                  className={`px-2 py-1 text-[10px] font-medium rounded flex items-center gap-1 ${
                    status === 'Running' ? 'bg-emerald-50 text-emerald-700' :
                    status === 'Queued' ? 'bg-blue-50 text-blue-700' :
                    status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                    status === 'Completed' ? 'bg-slate-100 text-slate-600' :
                    'bg-gray-50 text-gray-600'
                  }`}
                >
                  {status}
                  <span className={`px-1 rounded-full ${
                    status === 'Running' ? 'bg-emerald-100' :
                    status === 'Queued' ? 'bg-blue-100' :
                    status === 'Pending' ? 'bg-amber-100' :
                    'bg-gray-200'
                  }`}>
                    {(jobs as string[]).length}
                  </span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
