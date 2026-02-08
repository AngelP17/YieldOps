import { useState, useMemo } from 'react';
import { 
  IconShield, 
  IconActivity, 
  IconCpu, 
  IconChevronDown, 
  IconChevronRight,
  IconSearch,
  IconFilter,
  IconX
} from '@tabler/icons-react';
import { SentinelAgentCard } from './SentinelAgentCard';
import type { AegisAgent } from '../../types';

interface SentinelAgentListProps {
  agents: AegisAgent[];
}

type AgentType = 'all' | 'facility' | 'assembly' | 'precision';

const AGENT_TYPE_CONFIG: Record<string, { 
  label: string; 
  icon: typeof IconShield; 
  color: string; 
  bgColor: string;
  description: string;
}> = {
  facility: { 
    label: 'Facility Agents', 
    icon: IconShield, 
    color: 'text-emerald-600', 
    bgColor: 'bg-emerald-50',
    description: 'Cleanroom & Environment'
  },
  assembly: { 
    label: 'Assembly Agents', 
    icon: IconActivity, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-50',
    description: 'Wire Bonding & Packaging'
  },
  precision: { 
    label: 'Precision Agents', 
    icon: IconCpu, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50',
    description: 'Process & Metrology'
  },
};

export function SentinelAgentList({ agents }: SentinelAgentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AgentType>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['facility', 'assembly', 'precision'])
  );

  // Group agents by type
  const groupedAgents = useMemo(() => {
    const groups: Record<string, AegisAgent[]> = {
      facility: [],
      assembly: [],
      precision: [],
    };

    agents.forEach(agent => {
      if (groups[agent.agent_type]) {
        groups[agent.agent_type].push(agent);
      } else {
        // Fallback for unknown types
        groups.precision.push(agent);
      }
    });

    // Sort each group by machine_id
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.machine_id.localeCompare(b.machine_id));
    });

    return groups;
  }, [agents]);

  // Filter agents based on search and type filter
  const filteredGroups = useMemo(() => {
    const result: Record<string, AegisAgent[]> = {
      facility: [],
      assembly: [],
      precision: [],
    };

    Object.keys(groupedAgents).forEach(type => {
      if (typeFilter !== 'all' && typeFilter !== type) {
        return;
      }
      
      result[type] = groupedAgents[type].filter(agent => 
        agent.machine_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.agent_id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    return result;
  }, [groupedAgents, searchQuery, typeFilter]);

  // Calculate counts
  const counts = useMemo(() => {
    return {
      facility: groupedAgents.facility.length,
      assembly: groupedAgents.assembly.length,
      precision: groupedAgents.precision.length,
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
    };
  }, [groupedAgents, agents]);

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(['facility', 'assembly', 'precision']));
  const collapseAll = () => setExpandedGroups(new Set());

  const hasFilteredResults = Object.values(filteredGroups).some(group => group.length > 0);

  return (
    <div className="space-y-4">
      {/* Header with Search and Controls */}
      <div className="flex flex-col gap-3">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Sentinel Agents</h3>
            <span className="text-xs text-slate-500">
              {counts.active}/{counts.total} active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Expand
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Search and Filter Row */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AgentType)}
              className="appearance-none pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="facility">Facility</option>
              <option value="assembly">Assembly</option>
              <option value="precision">Precision</option>
            </select>
            <IconFilter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Quick Type Filters */}
        <div className="flex items-center gap-2">
          {(['facility', 'assembly', 'precision'] as const).map(type => {
            const config = AGENT_TYPE_CONFIG[type];
            const Icon = config.icon;
            const isActive = typeFilter === type;
            const count = counts[type];
            
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(isActive ? 'all' : type)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? `${config.bgColor} ${config.color} ring-1 ring-inset ring-current`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="capitalize">{type}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? 'bg-white/60' : 'bg-white'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent Groups */}
      {hasFilteredResults ? (
        <div className="space-y-3">
          {(['facility', 'assembly', 'precision'] as const).map(type => {
            const groupAgents = filteredGroups[type];
            if (groupAgents.length === 0) return null;

            const config = AGENT_TYPE_CONFIG[type];
            const Icon = config.icon;
            const isExpanded = expandedGroups.has(type);
            const activeCount = groupAgents.filter(a => a.status === 'active').length;

            return (
              <div key={type} className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${config.bgColor}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-semibold text-slate-900">{config.label}</h4>
                      <p className="text-xs text-slate-500">{config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-medium text-slate-900">{groupAgents.length}</span>
                      <span className="text-xs text-slate-500"> agents</span>
                      {activeCount > 0 && (
                        <span className="text-xs text-emerald-600 ml-1">({activeCount} active)</span>
                      )}
                    </div>
                    {isExpanded ? (
                      <IconChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <IconChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Group Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2">
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                        {groupAgents.map(agent => (
                          <SentinelAgentCard 
                            key={agent.agent_id} 
                            agent={agent} 
                            variant="compact" 
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {groupAgents.map(agent => (
                          <SentinelAgentCard 
                            key={agent.agent_id} 
                            agent={agent} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <IconSearch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No agents found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
