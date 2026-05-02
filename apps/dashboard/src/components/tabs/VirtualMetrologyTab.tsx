import { useState, useMemo } from 'react';
import {
  IconChartLine, IconRuler, IconAlertTriangle, IconCheck,
  IconHistory, IconSettings, IconTrendingUp, IconActivity,
  IconRefresh, IconDownload
} from '@tabler/icons-react';
import { useToast } from '../ui/Toast';

// Mock VM data for demo mode
const MOCK_VM_TOOLS = [
  { tool_id: 'LITHO-01', name: 'LITHO-01', type: 'lithography', recipe: '5NM_FINFE', predicted_thickness: 42.3, actual_thickness: 42.1, confidence: 0.94, control_limit_upper: 45.0, control_limit_lower: 39.0, drift: 0.2, status: 'normal' },
  { tool_id: 'LITHO-02', name: 'LITHO-02', type: 'lithography', recipe: '3NM_GAA', predicted_thickness: 38.7, actual_thickness: 39.2, confidence: 0.91, control_limit_upper: 42.0, control_limit_lower: 36.0, drift: -0.5, status: 'warning' },
  { tool_id: 'ETCH-01', name: 'ETCH-01', type: 'etching', recipe: 'DEEP_SI_ETCH', predicted_thickness: 125.0, actual_thickness: 124.8, confidence: 0.96, control_limit_upper: 130.0, control_limit_lower: 120.0, drift: 0.2, status: 'normal' },
  { tool_id: 'DEP-01', name: 'DEP-01', type: 'deposition', recipe: 'ALD_HFO2', predicted_thickness: 8.5, actual_thickness: 8.7, confidence: 0.89, control_limit_upper: 10.0, control_limit_lower: 7.0, drift: -0.2, status: 'normal' },
  { tool_id: 'DEP-03', name: 'DEP-03', type: 'deposition', recipe: 'CVD_W', predicted_thickness: 55.2, actual_thickness: 56.1, confidence: 0.87, control_limit_upper: 58.0, control_limit_lower: 52.0, drift: -0.9, status: 'warning' },
  { tool_id: 'INSP-01', name: 'INSP-01', type: 'inspection', recipe: 'CD_SEM', predicted_thickness: 22.0, actual_thickness: 22.0, confidence: 0.98, control_limit_upper: 24.0, control_limit_lower: 20.0, drift: 0.0, status: 'normal' },
];

const MOCK_PREDICTION_HISTORY = [
  { timestamp: '2024-12-16 08:00', tool: 'LITHO-01', predicted: 42.3, actual: 42.1, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 07:30', tool: 'LITHO-01', predicted: 42.1, actual: 42.0, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 07:00', tool: 'LITHO-01', predicted: 42.4, actual: 42.5, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 06:30', tool: 'LITHO-01', predicted: 42.2, actual: 42.2, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 06:00', tool: 'LITHO-01', predicted: 42.0, actual: 41.9, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 05:30', tool: 'LITHO-01', predicted: 42.1, actual: 42.3, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 05:00', tool: 'LITHO-01', predicted: 42.3, actual: 42.1, recipe: '5NM_FINFE' },
  { timestamp: '2024-12-16 04:30', tool: 'LITHO-01', predicted: 42.2, actual: 42.0, recipe: '5NM_FINFE' },
];

export function VirtualMetrologyTab() {
  const { toast } = useToast();
  const [selectedTool, setSelectedTool] = useState(MOCK_VM_TOOLS[0]);
  const [refreshing, setRefreshing] = useState(false);

  const history = useMemo(() => MOCK_PREDICTION_HISTORY, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast('Virtual Metrology models refreshed', 'success');
    }, 1500);
  };

  const handleCalibrate = () => {
    toast(`Calibration initiated for ${selectedTool.name}`, 'info');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Virtual Metrology Lab</h2>
          <p className="text-sm text-zinc-500">Predictive process control and SPC monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors">
            <IconRefresh className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Models
          </button>
          <button onClick={handleCalibrate} className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            <IconSettings className="w-4 h-4" />
            Calibrate
          </button>
        </div>
      </div>

      {/* Tool Selector */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <IconRuler className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-700">Select Tool</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOCK_VM_TOOLS.map((tool) => (
            <button
              key={tool.tool_id}
              onClick={() => setSelectedTool(tool)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTool.tool_id === tool.tool_id
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tool.status === 'normal' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {tool.name}
              </div>
              <div className="text-xs opacity-70 mt-0.5">{tool.recipe}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Prediction Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Current Prediction */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <IconChartLine className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-zinc-900">Current Prediction</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-zinc-500 mb-1">Predicted Thickness</div>
              <div className="text-3xl font-bold text-zinc-900">{selectedTool.predicted_thickness.toFixed(1)} nm</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 rounded-lg p-3">
                <div className="text-xs text-zinc-500">Actual</div>
                <div className="text-lg font-semibold text-zinc-800">{selectedTool.actual_thickness.toFixed(1)} nm</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-3">
                <div className="text-xs text-zinc-500">Confidence</div>
                <div className="text-lg font-semibold text-zinc-800">{(selectedTool.confidence * 100).toFixed(0)}%</div>
              </div>
            </div>
            
            <div>
              <div className="text-xs text-zinc-500 mb-1">Drift Indicator</div>
              <div className={`flex items-center gap-2 text-sm font-medium ${selectedTool.drift > 0.5 || selectedTool.drift < -0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {selectedTool.drift > 0.5 || selectedTool.drift < -0.5 ? <IconAlertTriangle className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
                {selectedTool.drift > 0 ? '+' : ''}{selectedTool.drift.toFixed(1)} nm
              </div>
            </div>
            
            <div>
              <div className="text-xs text-zinc-500 mb-1">R2R Adjustment</div>
              <div className="text-sm font-mono bg-amber-50 text-amber-800 px-3 py-2 rounded-lg">
                Adjust recipe param: {selectedTool.drift > 0 ? '-' : '+'} {Math.abs(selectedTool.drift * 0.8).toFixed(2)} nm
              </div>
            </div>
          </div>
        </div>

        {/* SPC Control Limits */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <IconActivity className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-zinc-900">SPC Control Limits</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm text-zinc-600">Upper Control Limit (UCL)</span>
              <span className="text-sm font-mono font-semibold text-zinc-900">{selectedTool.control_limit_upper.toFixed(1)} nm</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm text-zinc-600">Target</span>
              <span className="text-sm font-mono font-semibold text-zinc-900">{((selectedTool.control_limit_upper + selectedTool.control_limit_lower) / 2).toFixed(1)} nm</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm text-zinc-600">Lower Control Limit (LCL)</span>
              <span className="text-sm font-mono font-semibold text-zinc-900">{selectedTool.control_limit_lower.toFixed(1)} nm</span>
            </div>
            
            {/* Visual gauge */}
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-2">Current Position</div>
              <div className="relative h-8 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 bottom-0 rounded-full transition-all ${selectedTool.status === 'normal' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ 
                    left: '10%', 
                    width: '80%' 
                  }}
                />
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-zinc-900 rounded-full"
                  style={{ 
                    left: `${10 + ((selectedTool.predicted_thickness - selectedTool.control_limit_lower) / (selectedTool.control_limit_upper - selectedTool.control_limit_lower)) * 80}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-400 mt-1">
                <span>{selectedTool.control_limit_lower} nm</span>
                <span>{selectedTool.control_limit_upper} nm</span>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${selectedTool.status === 'normal' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <div className={`w-2 h-2 rounded-full ${selectedTool.status === 'normal' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-sm font-medium">
                {selectedTool.status === 'normal' ? 'Process In Control' : 'Drift Warning - R2R Recommended'}
              </span>
            </div>
          </div>
        </div>

        {/* Model Status */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <IconTrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-zinc-900">Model Status</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Model Version', value: 'v2.4.1', status: 'current' },
              { label: 'Training Data', value: '12,400 wafers', status: 'good' },
              { label: 'R2 Score', value: '0.94', status: 'good' },
              { label: 'RMSE', value: '0.32 nm', status: 'good' },
              { label: 'Last Retrained', value: '2024-12-14', status: 'current' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-sm text-zinc-600">{item.label}</span>
                <span className="text-sm font-mono font-semibold text-zinc-900">{item.value}</span>
              </div>
            ))}
            
            <button 
              onClick={() => toast('Model retraining queued', 'info')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors mt-2"
            >
              <IconRefresh className="w-4 h-4" />
              Retrain Model
            </button>
          </div>
        </div>
      </div>

      {/* Prediction History */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconHistory className="w-5 h-5 text-zinc-600" />
            <h3 className="font-semibold text-zinc-900">Prediction History - {selectedTool.name}</h3>
          </div>
          <button 
            onClick={() => toast('History exported to CSV', 'success')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <IconDownload className="w-4 h-4" />
            Export
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Timestamp</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Tool</th>
                <th className="text-left py-2 px-3 font-medium text-zinc-500">Recipe</th>
                <th className="text-right py-2 px-3 font-medium text-zinc-500">Predicted</th>
                <th className="text-right py-2 px-3 font-medium text-zinc-500">Actual</th>
                <th className="text-right py-2 px-3 font-medium text-zinc-500">Error</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
                <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="py-2 px-3 text-zinc-700">{row.timestamp}</td>
                  <td className="py-2 px-3 text-zinc-700 font-medium">{row.tool}</td>
                  <td className="py-2 px-3 text-zinc-600">{row.recipe}</td>
                  <td className="py-2 px-3 text-right font-mono text-zinc-900">{row.predicted.toFixed(1)} nm</td>
                  <td className="py-2 px-3 text-right font-mono text-zinc-900">{row.actual.toFixed(1)} nm</td>
                  <td className={`py-2 px-3 text-right font-mono ${Math.abs(row.predicted - row.actual) < 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {(row.predicted - row.actual).toFixed(1)} nm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
