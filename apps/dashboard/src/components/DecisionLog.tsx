import React, { useState } from 'react';
import { 
  IconBrain, 
  IconClock, 
  IconCircleCheckFilled, 
  IconCircleX, 
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconBolt,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconCpu,
  IconArrowRight,
  IconSparkles,
  IconDownload
} from '@tabler/icons-react';
import { useToast } from './ui/Toast';

interface Decision {
  id: string;
  timestamp: Date;
  type: 'job_dispatch' | 'machine_routing' | 'maintenance_scheduling' | 'anomaly_response' | 'load_balancing';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  confidence: number;
  title: string;
  description: string;
  context: {
    triggerEvent: string;
    affectedMachines: string[];
    estimatedImpact: {
      efficiency: number;
      throughput: number;
      cost: number;
    };
  };
  recommendation: {
    action: string;
    targetMachine?: string;
    expectedOutcome: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  actualOutcome?: {
    efficiencyDelta: number;
    throughputDelta: number;
    resolutionTime: number;
  };
  reasoning: string[];
}

const MOCK_DECISIONS: Decision[] = [
  {
    id: 'DEC-2024-0892',
    timestamp: new Date(Date.now() - 1000 * 60 * 3),
    type: 'anomaly_response',
    status: 'executed',
    confidence: 0.94,
    title: 'Thermal Anomaly Auto-Response',
    description: 'Detected temperature spike in Litho-A1, initiated emergency cooling protocol',
    context: {
      triggerEvent: 'Temperature exceeded 95°C threshold',
      affectedMachines: ['Litho-A1', 'Litho-A2'],
      estimatedImpact: {
        efficiency: -0.15,
        throughput: -25,
        cost: 1200,
      },
    },
    recommendation: {
      action: 'Emergency shutdown and cooling activation',
      targetMachine: 'Litho-A1',
      expectedOutcome: 'Prevent wafer damage, maintain quality standards',
      riskLevel: 'high',
    },
    actualOutcome: {
      efficiencyDelta: -0.08,
      throughputDelta: -12,
      resolutionTime: 4.5,
    },
    reasoning: [
      'Temperature sensor reading 97.3°C exceeds critical threshold (95°C)',
      'Historical data shows 89% probability of wafer damage above 96°C',
      'Litho-A2 has available capacity (78% idle) for load transfer',
      'Emergency cooling can reduce temperature to safe levels within 5 minutes',
      'Cost of shutdown ($1,200) < estimated wafer loss ($8,500)',
    ],
  },
  {
    id: 'DEC-2024-0891',
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    type: 'job_dispatch',
    status: 'executed',
    confidence: 0.87,
    title: 'Hot Lot Priority Routing',
    description: 'Rerouted Apple hot lot WF-2024-0849 to Litho-B1 for expedited processing',
    context: {
      triggerEvent: 'Hot lot deadline within 4 hours',
      affectedMachines: ['Litho-B1'],
      estimatedImpact: {
        efficiency: 0.05,
        throughput: 15,
        cost: 0,
      },
    },
    recommendation: {
      action: 'Priority queue insertion and machine pre-warming',
      targetMachine: 'Litho-B1',
      expectedOutcome: 'Meet customer SLA, maintain relationship',
      riskLevel: 'low',
    },
    actualOutcome: {
      efficiencyDelta: 0.03,
      throughputDelta: 18,
      resolutionTime: 0.5,
    },
    reasoning: [
      'Hot lot priority level 1 requires SLA compliance within 4 hours',
      'Current queue position would result in 6-hour completion time',
      'Litho-B1 idle state allows immediate processing start',
      'Pre-warming reduces setup time by 40% (12 min → 7 min)',
      'Customer Apple represents $2.4M quarterly revenue',
    ],
  },
  {
    id: 'DEC-2024-0890',
    timestamp: new Date(Date.now() - 1000 * 60 * 28),
    type: 'load_balancing',
    status: 'executed',
    confidence: 0.91,
    title: 'Etching Bay Load Redistribution',
    description: 'Balanced wafer load across Etch-C1 and Etch-C2 to optimize throughput',
    context: {
      triggerEvent: 'Etch-C1 queue depth exceeded 15 wafers',
      affectedMachines: ['Etch-C1', 'Etch-C2'],
      estimatedImpact: {
        efficiency: 0.12,
        throughput: 32,
        cost: 0,
      },
    },
    recommendation: {
      action: 'Redistribute 8 wafers from Etch-C1 to Etch-C2',
      expectedOutcome: 'Reduce queue time by 45%, improve overall throughput',
      riskLevel: 'low',
    },
    actualOutcome: {
      efficiencyDelta: 0.14,
      throughputDelta: 35,
      resolutionTime: 2.1,
    },
    reasoning: [
      'Etch-C1 queue depth (18 wafers) exceeds optimal threshold (12)',
      'Etch-C2 operating at 62% capacity with compatible recipe availability',
      'Redistribution reduces average queue time from 24 min to 13 min',
      'Both machines use identical N7-ETCH recipe - no setup penalty',
      'Predicted throughput increase: 32 wafers/hour → 43 wafers/hour',
    ],
  },
  {
    id: 'DEC-2024-0889',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    type: 'maintenance_scheduling',
    status: 'approved',
    confidence: 0.78,
    title: 'Predictive Maintenance: Insp-F1',
    description: 'Scheduled inspection unit maintenance based on vibration pattern analysis',
    context: {
      triggerEvent: 'Vibration trend indicates bearing wear',
      affectedMachines: ['Insp-F1'],
      estimatedImpact: {
        efficiency: -0.05,
        throughput: -8,
        cost: 3500,
      },
    },
    recommendation: {
      action: 'Schedule maintenance window during low-demand period',
      targetMachine: 'Insp-F1',
      expectedOutcome: 'Prevent unplanned downtime, extend equipment life',
      riskLevel: 'medium',
    },
    reasoning: [
      'Vibration analysis shows 23% increase over 7-day trend',
      'Frequency spectrum indicates bearing wear pattern (BPFI: 156 Hz)',
      'Predictive model: 72% probability of failure within 48 hours',
      'Scheduled maintenance cost: $3,500 vs unplanned: $18,000+',
      'Optimal window: 02:00-06:00 (historical low demand)',
    ],
  },
  {
    id: 'DEC-2024-0888',
    timestamp: new Date(Date.now() - 1000 * 60 * 62),
    type: 'machine_routing',
    status: 'rejected',
    confidence: 0.62,
    title: 'Alternative Routing: Dep-E2',
    description: 'Proposed routing Samsung batch to Dep-E2 due to Dep-E1 congestion',
    context: {
      triggerEvent: 'Dep-E1 queue time exceeds 30 minutes',
      affectedMachines: ['Dep-E1', 'Dep-E2'],
      estimatedImpact: {
        efficiency: -0.08,
        throughput: -5,
        cost: 800,
      },
    },
    recommendation: {
      action: 'Reroute to Dep-E2 with recipe adjustment',
      targetMachine: 'Dep-E2',
      expectedOutcome: 'Reduce queue time, maintain schedule',
      riskLevel: 'medium',
    },
    reasoning: [
      'Dep-E1 queue time (34 min) exceeds SLA threshold (30 min)',
      'Dep-E2 available but requires recipe conversion (N5-STD → N5-ALT)',
      'Recipe conversion adds 15 min setup time and $800 material cost',
      'Confidence below threshold (62% < 70%) due to quality risk',
      'Alternative: Wait 8 min for Dep-E1 (89% confidence)',
    ],
  },
];

const DECISION_TYPES = {
  job_dispatch: { label: 'Job Dispatch', icon: IconBolt, color: 'blue' },
  machine_routing: { label: 'Routing', icon: IconArrowRight, color: 'indigo' },
  maintenance_scheduling: { label: 'Maintenance', icon: IconClock, color: 'amber' },
  anomaly_response: { label: 'Anomaly', icon: IconAlertTriangle, color: 'rose' },
  load_balancing: { label: 'Load Balance', icon: IconTrendingUp, color: 'emerald' },
};

export const DecisionLog: React.FC = () => {
  const [expandedDecision, setExpandedDecision] = useState<string | null>('DEC-2024-0892');
  const [filter, setFilter] = useState<'all' | 'executed' | 'approved' | 'rejected'>('all');
  const [decisions, setDecisions] = useState<Decision[]>(MOCK_DECISIONS);
  const { toast } = useToast();

  const filteredDecisions = decisions.filter(d => 
    filter === 'all' ? true : d.status === filter
  );

  const handleApprove = (decisionId: string) => {
    setDecisions(prev => prev.map(d => 
      d.id === decisionId ? { ...d, status: 'approved' as const } : d
    ));
    toast(`Decision ${decisionId} approved`, 'success');
  };

  const handleReject = (decisionId: string) => {
    setDecisions(prev => prev.map(d => 
      d.id === decisionId ? { ...d, status: 'rejected' as const } : d
    ));
    toast(`Decision ${decisionId} rejected`, 'info');
  };

  const handleExport = () => {
    const csvContent = [
      ['Decision ID', 'Title', 'Type', 'Status', 'Confidence', 'Timestamp'].join(','),
      ...decisions.map(d => [
        d.id,
        `"${d.title}"`,
        d.type,
        d.status,
        `${(d.confidence * 100).toFixed(0)}%`,
        d.timestamp.toISOString()
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast('Decision log exported', 'success');
  };

  const getStatusIcon = (status: Decision['status']) => {
    switch (status) {
      case 'executed':
        return <IconCircleCheckFilled className="w-4 h-4 text-emerald-500" />;
      case 'approved':
        return <IconCircleCheckFilled className="w-4 h-4 text-blue-500" />;
      case 'rejected':
        return <IconCircleX className="w-4 h-4 text-slate-400" />;
      case 'pending':
        return <IconClock className="w-4 h-4 text-amber-500" />;
      case 'failed':
        return <IconCircleX className="w-4 h-4 text-rose-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-emerald-600 bg-emerald-50';
    if (confidence >= 0.8) return 'text-blue-600 bg-blue-50';
    if (confidence >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getTrendIcon = (delta: number) => {
    if (delta > 0) return <IconTrendingUp className="w-3 h-3 text-emerald-500" />;
    if (delta < 0) return <IconTrendingDown className="w-3 h-3 text-rose-500" />;
    return <IconMinus className="w-3 h-3 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Decisions</p>
          <p className="text-2xl font-bold text-slate-900">1,247</p>
          <p className="text-xs text-emerald-600 mt-1">+12 today</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Confidence</p>
          <p className="text-2xl font-bold text-slate-900">87.3%</p>
          <p className="text-xs text-emerald-600 mt-1">+2.1% vs last week</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-slate-900">94.2%</p>
          <p className="text-xs text-emerald-600 mt-1">+0.8% vs last week</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Time Saved</p>
          <p className="text-2xl font-bold text-slate-900">384h</p>
          <p className="text-xs text-emerald-600 mt-1">This month</p>
        </div>
      </div>

      {/* Decision List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <IconBrain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Decision Log</h3>
              <p className="text-xs text-slate-500">Autonomous system decisions with reasoning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'executed' | 'approved' | 'rejected')}
              className="text-xs font-medium text-slate-600 bg-slate-100 rounded-lg px-3 py-2 border-0 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Decisions</option>
              <option value="executed">Executed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button 
              onClick={handleExport}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Export to CSV"
            >
              <IconDownload className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredDecisions.map((decision) => {
            const typeConfig = DECISION_TYPES[decision.type];
            const TypeIcon = typeConfig.icon;
            const isExpanded = expandedDecision === decision.id;

            return (
              <div 
                key={decision.id} 
                className={`transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
              >
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedDecision(isExpanded ? null : decision.id)}
                  className="w-full px-4 sm:px-6 py-4 text-left"
                >
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-xl
                      ${decision.type === 'anomaly_response' ? 'bg-rose-100' :
                        decision.type === 'job_dispatch' ? 'bg-blue-100' :
                        decision.type === 'load_balancing' ? 'bg-emerald-100' :
                        decision.type === 'maintenance_scheduling' ? 'bg-amber-100' :
                        'bg-indigo-100'}
                    `}>
                      <TypeIcon className={`w-5 h-5 ${
                        decision.type === 'anomaly_response' ? 'text-rose-600' :
                        decision.type === 'job_dispatch' ? 'text-blue-600' :
                        decision.type === 'load_balancing' ? 'text-emerald-600' :
                        decision.type === 'maintenance_scheduling' ? 'text-amber-600' :
                        'text-indigo-600'
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            <span className="text-xs font-medium text-slate-400">{decision.id}</span>
                            <span className="text-sm font-semibold text-slate-900">{decision.title}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{decision.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getConfidenceColor(decision.confidence)}`}>
                              {(decision.confidence * 100).toFixed(0)}% confidence
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <IconCpu className="w-3 h-3" />
                              {decision.context.affectedMachines.join(', ')}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatTimeAgo(decision.timestamp)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {getStatusIcon(decision.status)}
                          <span className={`
                            px-2.5 py-1 rounded-full text-xs font-medium
                            ${decision.status === 'executed' ? 'bg-emerald-100 text-emerald-700' :
                              decision.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                              decision.status === 'rejected' ? 'bg-slate-100 text-slate-600' :
                              'bg-amber-100 text-amber-700'}
                          `}>
                            {decision.status}
                          </span>
                          {isExpanded ? (
                            <IconChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <IconChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-6">
                    <div className="pl-0 sm:pl-14 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {/* Left Column - Context & Reasoning */}
                      <div className="space-y-4">
                        {/* Trigger Event */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                            Trigger Event
                          </h4>
                          <p className="text-sm text-slate-600">{decision.context.triggerEvent}</p>
                        </div>

                        {/* AI Reasoning */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <IconSparkles className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                              AI Reasoning
                            </h4>
                          </div>
                          <ul className="space-y-2">
                            {decision.reasoning.map((reason, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-indigo-800">
                                <span className="text-indigo-400 mt-1">•</span>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Recommendation */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                            Recommended Action
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Action</span>
                              <span className="text-sm font-medium text-slate-900">{decision.recommendation.action}</span>
                            </div>
                            {decision.recommendation.targetMachine && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Target</span>
                                <span className="text-sm font-medium text-slate-900">{decision.recommendation.targetMachine}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Risk Level</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                decision.recommendation.riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' :
                                decision.recommendation.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-rose-100 text-rose-700'
                              }`}>
                                {decision.recommendation.riskLevel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                              Expected: {decision.recommendation.expectedOutcome}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Impact & Outcome */}
                      <div className="space-y-4">
                        {/* Estimated Impact */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                            Estimated Impact
                          </h4>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
                              <p className="text-xs text-slate-500 mb-1">Efficiency</p>
                              <p className={`text-base sm:text-lg font-bold ${decision.context.estimatedImpact.efficiency >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {decision.context.estimatedImpact.efficiency > 0 ? '+' : ''}
                                {(decision.context.estimatedImpact.efficiency * 100).toFixed(0)}%
                              </p>
                            </div>
                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                              <p className="text-xs text-slate-500 mb-1">Throughput</p>
                              <p className={`text-base sm:text-lg font-bold ${decision.context.estimatedImpact.throughput >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {decision.context.estimatedImpact.throughput > 0 ? '+' : ''}
                                {decision.context.estimatedImpact.throughput}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                              <p className="text-xs text-slate-500 mb-1">Cost</p>
                              <p className="text-base sm:text-lg font-bold text-slate-900">
                                ${decision.context.estimatedImpact.cost.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actual Outcome */}
                        {decision.actualOutcome && (
                          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <IconCircleCheckFilled className="w-4 h-4 text-emerald-500" />
                              <h4 className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                                Actual Outcome
                              </h4>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-emerald-700">Efficiency Change</span>
                                <div className="flex items-center gap-1">
                                  {getTrendIcon(decision.actualOutcome.efficiencyDelta)}
                                  <span className={`text-sm font-bold ${decision.actualOutcome.efficiencyDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {decision.actualOutcome.efficiencyDelta > 0 ? '+' : ''}
                                    {(decision.actualOutcome.efficiencyDelta * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-emerald-700">Throughput Change</span>
                                <div className="flex items-center gap-1">
                                  {getTrendIcon(decision.actualOutcome.throughputDelta)}
                                  <span className={`text-sm font-bold ${decision.actualOutcome.throughputDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {decision.actualOutcome.throughputDelta > 0 ? '+' : ''}
                                    {decision.actualOutcome.throughputDelta} wafers
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-emerald-700">Resolution Time</span>
                                <span className="text-sm font-bold text-emerald-700">
                                  {decision.actualOutcome.resolutionTime} min
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {decision.status === 'pending' && (
                          <div className="flex gap-3">
                            <button 
                              onClick={() => handleApprove(decision.id)}
                              className="flex-1 py-2.5 px-4 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleReject(decision.id)}
                              className="flex-1 py-2.5 px-4 bg-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-300 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default DecisionLog;
