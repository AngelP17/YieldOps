import { useState, useMemo, useCallback } from 'react';
import {
  IconBrain, IconZoomIn, IconSearch,
  IconRefresh, IconDownload, IconGraph
} from '@tabler/icons-react';
import { useToast } from '../ui/Toast';

interface GraphNode {
  id: string;
  label: string;
  type: 'machine' | 'job' | 'incident' | 'recipe' | 'zone';
  status?: string;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

const MOCK_NODES: GraphNode[] = [
  { id: 'LITHO-01', label: 'LITHO-01', type: 'machine', status: 'RUNNING', metadata: { zone: 'ZONE_A', efficiency: 0.96 } },
  { id: 'LITHO-02', label: 'LITHO-02', type: 'machine', status: 'RUNNING', metadata: { zone: 'ZONE_A', efficiency: 0.94 } },
  { id: 'ETCH-01', label: 'ETCH-01', type: 'machine', status: 'RUNNING', metadata: { zone: 'ZONE_B', efficiency: 0.93 } },
  { id: 'ETCH-05', label: 'ETCH-05', type: 'machine', status: 'DOWN', metadata: { zone: 'ZONE_B', efficiency: 0.85 } },
  { id: 'DEP-01', label: 'DEP-01', type: 'machine', status: 'RUNNING', metadata: { zone: 'ZONE_C', efficiency: 0.91 } },
  { id: 'INSP-01', label: 'INSP-01', type: 'machine', status: 'RUNNING', metadata: { zone: 'ZONE_D', efficiency: 0.94 } },
  { id: 'HOT-LOT-001', label: 'HOT-LOT-001', type: 'job', status: 'RUNNING', metadata: { priority: 1, customer: 'APPLE' } },
  { id: 'HOT-LOT-002', label: 'HOT-LOT-002', type: 'job', status: 'QUEUED', metadata: { priority: 1, customer: 'NVIDIA' } },
  { id: 'WF-103', label: 'WAFER-BATCH-103', type: 'job', status: 'RUNNING', metadata: { priority: 2, customer: 'AMD' } },
  { id: 'INC-001', label: 'Thermal Drift ETCH-05', type: 'incident', status: 'OPEN', metadata: { severity: 'high', type: 'thermal' } },
  { id: 'INC-002', label: 'Vibration Spike LITHO-02', type: 'incident', status: 'RESOLVED', metadata: { severity: 'medium', type: 'vibration' } },
  { id: '5NM_FINFE', label: '5NM_FINFE', type: 'recipe', metadata: { layer: 'gate' } },
  { id: 'ADVANCED_LOGIC', label: 'ADVANCED_LOGIC', type: 'recipe', metadata: { layer: 'metal' } },
  { id: 'ZONE_A', label: 'Zone A (Lithography)', type: 'zone', metadata: { machine_count: 8 } },
  { id: 'ZONE_B', label: 'Zone B (Etching)', type: 'zone', metadata: { machine_count: 8 } },
];

const MOCK_EDGES: GraphEdge[] = [
  { source: 'LITHO-01', target: 'HOT-LOT-001', label: 'processing' },
  { source: 'LITHO-01', target: '5NM_FINFE', label: 'uses_recipe' },
  { source: 'LITHO-01', target: 'ZONE_A', label: 'located_in' },
  { source: 'LITHO-02', target: 'HOT-LOT-002', label: 'assigned' },
  { source: 'LITHO-02', target: 'INC-002', label: 'affected_by' },
  { source: 'LITHO-02', target: 'ZONE_A', label: 'located_in' },
  { source: 'ETCH-01', target: 'WF-103', label: 'processing' },
  { source: 'ETCH-01', target: 'ZONE_B', label: 'located_in' },
  { source: 'ETCH-05', target: 'INC-001', label: 'affected_by' },
  { source: 'ETCH-05', target: 'ZONE_B', label: 'located_in' },
  { source: 'HOT-LOT-001', target: 'ADVANCED_LOGIC', label: 'requires' },
  { source: 'HOT-LOT-002', target: '5NM_FINFE', label: 'requires' },
  { source: 'INC-001', target: 'INC-002', label: 'correlated_with' },
];

export function KnowledgeGraphTab() {
  const { toast } = useToast();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNodes = useMemo(() => {
    return MOCK_NODES.filter(n => {
      if (filterType !== 'all' && n.type !== filterType) return false;
      if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [filterType, searchQuery]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return MOCK_EDGES.filter(e => e.source === selectedNode.id || e.target === selectedNode.id);
  }, [selectedNode]);

  const handleNodeClick = useCallback((nodeId: string) => {
    const node = MOCK_NODES.find(n => n.id === nodeId);
    setSelectedNode(node || null);
  }, []);

  const stats = useMemo(() => ({
    machines: MOCK_NODES.filter(n => n.type === 'machine').length,
    jobs: MOCK_NODES.filter(n => n.type === 'job').length,
    incidents: MOCK_NODES.filter(n => n.type === 'incident').length,
    recipes: MOCK_NODES.filter(n => n.type === 'recipe').length,
    edges: MOCK_EDGES.length,
  }), []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Knowledge Graph Workbench</h2>
          <p className="text-sm text-zinc-500">Machine-job-incident relationship analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => toast('Graph layout refreshed', 'success')}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <IconRefresh className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={() => toast('Graph exported to GEXF', 'success')}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <IconDownload className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Machines', value: stats.machines, color: 'bg-blue-50 text-blue-700' },
          { label: 'Jobs', value: stats.jobs, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Incidents', value: stats.incidents, color: 'bg-rose-50 text-rose-700' },
          { label: 'Recipes', value: stats.recipes, color: 'bg-amber-50 text-amber-700' },
          { label: 'Relationships', value: stats.edges, color: 'bg-purple-50 text-purple-700' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-3 ${stat.color}`}>
            <div className="text-lg font-bold">{stat.value}</div>
            <div className="text-xs font-medium opacity-70">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Graph Visualization */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconGraph className="w-5 h-5 text-zinc-600" />
              <h3 className="font-semibold text-zinc-900">Graph Visualization</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <IconSearch className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-200 w-48"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-200"
              >
                <option value="all">All Types</option>
                <option value="machine">Machines</option>
                <option value="job">Jobs</option>
                <option value="incident">Incidents</option>
                <option value="recipe">Recipes</option>
                <option value="zone">Zones</option>
              </select>
            </div>
          </div>

          {/* Simple node grid as graph placeholder */}
          <div className="grid grid-cols-3 gap-3 min-h-[400px]">
            {filteredNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                className={`p-3 rounded-xl border text-left transition-all hover:shadow-md ${
                  selectedNode?.id === node.id
                    ? 'border-zinc-900 bg-zinc-50 ring-2 ring-zinc-200'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    node.type === 'machine' ? 'bg-blue-400' :
                    node.type === 'job' ? 'bg-emerald-400' :
                    node.type === 'incident' ? 'bg-rose-400' :
                    node.type === 'recipe' ? 'bg-amber-400' : 'bg-purple-400'
                  }`} />
                  <span className="text-xs font-medium text-zinc-500 uppercase">{node.type}</span>
                </div>
                <div className="font-semibold text-sm text-zinc-900">{node.label}</div>
                {node.status && (
                  <div className={`text-xs mt-1 font-medium ${
                    node.status === 'RUNNING' || node.status === 'RESOLVED' ? 'text-emerald-600' :
                    node.status === 'DOWN' || node.status === 'OPEN' ? 'text-rose-600' :
                    'text-amber-600'
                  }`}>
                    {node.status}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100">
            {[
              { type: 'machine', color: 'bg-blue-400', label: 'Machine' },
              { type: 'job', color: 'bg-emerald-400', label: 'Job' },
              { type: 'incident', color: 'bg-rose-400', label: 'Incident' },
              { type: 'recipe', color: 'bg-amber-400', label: 'Recipe' },
              { type: 'zone', color: 'bg-purple-400', label: 'Zone' },
            ].map((item) => (
              <div key={item.type} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                <span className="text-xs text-zinc-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Node Inspector */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <IconZoomIn className="w-5 h-5 text-zinc-600" />
            <h3 className="font-semibold text-zinc-900">Node Inspector</h3>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-50 rounded-lg">
                <div className="text-xs text-zinc-500 uppercase mb-1">{selectedNode.type}</div>
                <div className="text-lg font-bold text-zinc-900">{selectedNode.label}</div>
                <div className={`text-xs mt-1 font-medium ${
                  selectedNode.status === 'RUNNING' || selectedNode.status === 'RESOLVED' ? 'text-emerald-600' :
                  selectedNode.status === 'DOWN' || selectedNode.status === 'OPEN' ? 'text-rose-600' :
                  'text-amber-600'
                }`}>
                  Status: {selectedNode.status || 'N/A'}
                </div>
              </div>

              {selectedNode.metadata && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-zinc-700">Metadata</div>
                  {Object.entries(selectedNode.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg text-sm">
                      <span className="text-zinc-600 capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-mono font-medium text-zinc-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-700">Connected Relationships</div>
                {connectedEdges.length > 0 ? connectedEdges.map((edge, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-zinc-50 rounded-lg text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <span className="text-zinc-600">{edge.source}</span>
                    <span className="text-zinc-400">→</span>
                    <span className="text-zinc-600">{edge.target}</span>
                    <span className="text-xs text-zinc-400 ml-auto">{edge.label}</span>
                  </div>
                )) : (
                  <div className="text-sm text-zinc-400">No connections</div>
                )}
              </div>

              <button
                onClick={() => toast(`Inspecting ${selectedNode.label} in detail`, 'info')}
                className="w-full px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Inspect Full Evidence
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <IconBrain className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a node to inspect relationships and evidence</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
