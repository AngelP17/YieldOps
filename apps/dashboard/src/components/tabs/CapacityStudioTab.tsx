import { useState, useMemo } from 'react';
import {
  IconChartHistogram, IconPlayerPlay, IconDownload,
  IconTrendingUp, IconAlertTriangle, IconCheck,
  IconClock, IconCpu, IconStack, IconSettings, IconRefresh
} from '@tabler/icons-react';
import { useToast } from '../ui/Toast';

interface SimulationResult {
  horizon: string;
  simulations: number;
  meanThroughput: number;
  p95Throughput: number;
  p05Throughput: number;
  bottleneckProbability: number;
  hotLotRisk: number;
  lineUtilization: number;
  duration: number;
}

const MOCK_RESULTS: SimulationResult = {
  horizon: '30 days',
  simulations: 10000,
  meanThroughput: 2847,
  p95Throughput: 3124,
  p05Throughput: 2568,
  bottleneckProbability: 0.23,
  hotLotRisk: 0.08,
  lineUtilization: 0.87,
  duration: 1240,
};

const MOCK_DISTRIBUTION = [
  { bin: '2400-2500', count: 245, cumulative: 0.025 },
  { bin: '2500-2600', count: 512, cumulative: 0.076 },
  { bin: '2600-2700', count: 892, cumulative: 0.165 },
  { bin: '2700-2800', count: 1456, cumulative: 0.311 },
  { bin: '2800-2900', count: 1876, cumulative: 0.498 },
  { bin: '2900-3000', count: 1689, cumulative: 0.667 },
  { bin: '3000-3100', count: 1423, cumulative: 0.809 },
  { bin: '3100-3200', count: 987, cumulative: 0.908 },
  { bin: '3200-3300', count: 612, cumulative: 0.969 },
  { bin: '3300-3400', count: 308, cumulative: 1.000 },
];

const MOCK_BOTTLENECK_BY_ZONE = [
  { zone: 'ZONE_A (Litho)', probability: 0.34, tool: 'LITHO-05' },
  { zone: 'ZONE_B (Etch)', probability: 0.23, tool: 'ETCH-05' },
  { zone: 'ZONE_C (Dep)', probability: 0.18, tool: 'DEP-06' },
  { zone: 'ZONE_D (Insp)', probability: 0.12, tool: 'INSP-06' },
  { zone: 'ZONE_E (Clean)', probability: 0.08, tool: 'CLEAN-06' },
];

export function CapacityStudioTab() {
  const { toast } = useToast();
  const [horizon, setHorizon] = useState('30');
  const [simCount, setSimCount] = useState('10000');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationResult | null>(null);

  const handleRunSimulation = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setResults(MOCK_RESULTS);
      toast(`Monte Carlo complete: ${simCount} simulations in ${MOCK_RESULTS.duration}ms`, 'success');
    }, 2500);
  };

  const handleExport = () => {
    toast('Capacity forecast exported to CSV', 'success');
  };

  const maxCount = useMemo(() => Math.max(...MOCK_DISTRIBUTION.map(d => d.count)), []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Capacity Planning Studio</h2>
          <p className="text-sm text-zinc-500">Monte Carlo simulation for throughput forecasting</p>
        </div>
        {results && (
          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <IconDownload className="w-4 h-4" />
            Export Forecast
          </button>
        )}
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <IconSettings className="w-5 h-5 text-zinc-600" />
          <h3 className="font-semibold text-zinc-900">Simulation Parameters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Time Horizon</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Simulations</label>
            <select
              value={simCount}
              onChange={(e) => setSimCount(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="1000">1,000</option>
              <option value="5000">5,000</option>
              <option value="10000">10,000</option>
              <option value="50000">50,000</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRunSimulation}
              disabled={running}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {running ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconPlayerPlay className="w-4 h-4" />}
              {running ? 'Running Simulation...' : 'Run Monte Carlo'}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-sm text-zinc-500 mb-1">Mean Throughput</div>
              <div className="text-2xl font-bold text-zinc-900">{results.meanThroughput.toLocaleString()}</div>
              <div className="text-xs text-zinc-400 mt-1">wafers / {results.horizon}</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-sm text-zinc-500 mb-1">P95 Confidence</div>
              <div className="text-2xl font-bold text-emerald-600">{results.p95Throughput.toLocaleString()}</div>
              <div className="text-xs text-zinc-400 mt-1">upper bound</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-sm text-zinc-500 mb-1">Bottleneck Risk</div>
              <div className={`text-2xl font-bold ${results.bottleneckProbability > 0.3 ? 'text-rose-600' : 'text-amber-600'}`}>
                {(results.bottleneckProbability * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">probability</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-sm text-zinc-500 mb-1">Line Utilization</div>
              <div className="text-2xl font-bold text-blue-600">{(results.lineUtilization * 100).toFixed(0)}%</div>
              <div className="text-xs text-zinc-400 mt-1">average</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Throughput Distribution */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <IconChartHistogram className="w-5 h-5 text-zinc-600" />
                <h3 className="font-semibold text-zinc-900">Throughput Distribution</h3>
              </div>
              <div className="space-y-2">
                {MOCK_DISTRIBUTION.map((d) => (
                  <div key={d.bin} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-20 text-right">{d.bin}</span>
                    <div className="flex-1 h-6 bg-zinc-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded transition-all"
                        style={{ width: `${(d.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-600 w-12">{d.count}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-zinc-400 mt-3 pt-2 border-t border-zinc-100">
                <span>P5: {results.p05Throughput}</span>
                <span>Mean: {results.meanThroughput}</span>
                <span>P95: {results.p95Throughput}</span>
              </div>
            </div>

            {/* Bottleneck Analysis */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <IconAlertTriangle className="w-5 h-5 text-zinc-600" />
                <h3 className="font-semibold text-zinc-900">Bottleneck Probability by Zone</h3>
              </div>
              <div className="space-y-3">
                {MOCK_BOTTLENECK_BY_ZONE.map((zone) => (
                  <div key={zone.zone} className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-zinc-900">{zone.zone}</span>
                      <span className={`text-sm font-bold ${zone.probability > 0.3 ? 'text-rose-600' : 'text-amber-600'}`}>
                        {(zone.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${zone.probability > 0.3 ? 'bg-rose-400' : 'bg-amber-400'}`}
                        style={{ width: `${zone.probability * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">Most likely tool: {zone.tool}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hot Lot Risk & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <IconTrendingUp className="w-5 h-5 text-zinc-600" />
                <h3 className="font-semibold text-zinc-900">Hot Lot Risk Assessment</h3>
              </div>
              <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-900">{(results.hotLotRisk * 100).toFixed(0)}%</div>
                  <div className="text-xs text-zinc-500">Miss Deadline Risk</div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Current buffer</span>
                    <span className="font-medium text-zinc-900">12 hours</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Recommended action</span>
                    <span className="font-medium text-amber-600">Add 2 lithography tools</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Expected impact</span>
                    <span className="font-medium text-emerald-600">-4.2% risk reduction</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <IconCheck className="w-5 h-5 text-zinc-600" />
                <h3 className="font-semibold text-zinc-900">Recommendations</h3>
              </div>
              <div className="space-y-2">
                {[
                  { icon: IconCpu, text: 'Schedule preventive maintenance for ETCH-05', priority: 'high' },
                  { icon: IconStack, text: 'Pre-stage wafers for HOT-LOT-002 at LITHO-02', priority: 'medium' },
                  { icon: IconClock, text: 'Reduce queue time at DEP zone by 8%', priority: 'medium' },
                  { icon: IconTrendingUp, text: 'Consider capacity expansion in ZONE_B', priority: 'low' },
                ].map((rec, i) => {
                  const Icon = rec.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                      <Icon className="w-4 h-4 text-zinc-500 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm text-zinc-700">{rec.text}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        rec.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                        rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {!results && !running && (
        <div className="bg-white rounded-xl border border-zinc-200 border-dashed p-12 text-center">
          <IconChartHistogram className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-700 mb-2">No Simulation Results</h3>
          <p className="text-sm text-zinc-500 mb-4">Configure parameters and run a Monte Carlo simulation to see capacity forecasts</p>
          <button
            onClick={handleRunSimulation}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            Run First Simulation
          </button>
        </div>
      )}
    </div>
  );
}
