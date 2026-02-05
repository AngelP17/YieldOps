/**
 * Autonomous Job Configuration Panel
 * 
 * UI for configuring dynamic job generation parameters
 * Allows operators to control job generation behavior
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Play, 
  Pause, 
  Zap,
  BarChart3,
  Users,
  Clock,
  RotateCcw,
  Save,
  AlertCircle,
  CheckCircle2,
  Flame
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface JobGeneratorConfig {
  enabled: boolean;
  generation_interval_seconds: number;
  min_jobs: number;
  max_jobs: number;
  hot_lot_probability: number;
  priority_distribution: Record<string, number>;
  customer_weights: Record<string, number>;
  recipe_types: string[];
}

interface GeneratorStats {
  running: boolean;
  total_generated: number;
  last_generation: string | null;
  config: Partial<JobGeneratorConfig>;
}

export function AutonomousJobConfig() {
  const [config, setConfig] = useState<JobGeneratorConfig | null>(null);
  const [stats, setStats] = useState<GeneratorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'distribution' | 'customers'>('general');

  // Fetch config and stats
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [configRes, statsRes] = await Promise.all([
        apiClient.get('/job-generator/config'),
        apiClient.get('/job-generator/status'),
      ]);

      setConfig(configRes.data);
      setStats(statsRes.data);
    } catch (err) {
      setError('Failed to load configuration');
      console.error('Error fetching job generator config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Save configuration
  const saveConfig = async () => {
    if (!config) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      await apiClient.post('/job-generator/config', config);
      
      setSuccessMessage('Configuration saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      await fetchData();
    } catch (err) {
      setError('Failed to save configuration');
      console.error('Error saving config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle generator
  const toggleGenerator = async () => {
    try {
      const endpoint = stats?.running ? '/job-generator/stop' : '/job-generator/start';
      await apiClient.post(endpoint);
      await fetchData();
    } catch (err) {
      setError('Failed to toggle generator');
      console.error('Error toggling generator:', err);
    }
  };

  // Generate test job
  const generateTestJob = async () => {
    try {
      await apiClient.post('/job-generator/generate?triggered_by=manual_test');
      setSuccessMessage('Test job generated');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to generate test job');
      console.error('Error generating test job:', err);
    }
  };

  // Update priority distribution
  const updatePriorityDist = (priority: string, value: number) => {
    if (!config) return;
    setConfig({
      ...config,
      priority_distribution: {
        ...config.priority_distribution,
        [priority]: value,
      },
    });
  };

  // Update customer weight
  const updateCustomerWeight = (customer: string, weight: number) => {
    if (!config) return;
    setConfig({
      ...config,
      customer_weights: {
        ...config.customer_weights,
        [customer]: weight,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="text-center text-slate-500 py-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Failed to load configuration</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Autonomous Job Generator</h3>
              <p className="text-xs text-slate-500">Configure dynamic job creation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {stats?.running ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Running
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-slate-400 rounded-full" />
                Stopped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/30">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">
            {stats?.total_generated || 0}
          </div>
          <div className="text-xs text-slate-500">Jobs Generated</div>
        </div>
        <div className="text-center border-x border-slate-200">
          <div className="text-2xl font-bold text-slate-900">
            {config.generation_interval_seconds}s
          </div>
          <div className="text-xs text-slate-500">Check Interval</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">
            {config.min_jobs}-{config.max_jobs}
          </div>
          <div className="text-xs text-slate-500">Target Range</div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 mt-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'distribution', label: 'Priority', icon: BarChart3 },
            { id: 'customers', label: 'Customers', icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <h4 className="font-medium text-slate-900">Generator Status</h4>
                <p className="text-sm text-slate-500">Enable or disable autonomous job creation</p>
              </div>
              <button
                onClick={toggleGenerator}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  stats?.running
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {stats?.running ? (
                  <><Pause className="w-4 h-4" /> Stop</>
                ) : (
                  <><Play className="w-4 h-4" /> Start</>
                )}
              </button>
            </div>

            {/* Interval */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Check Interval (seconds)
              </label>
              <input
                type="range"
                min="5"
                max="300"
                step="5"
                value={config.generation_interval_seconds}
                onChange={(e) => setConfig({ ...config, generation_interval_seconds: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>5s</span>
                <span className="font-medium text-slate-900">{config.generation_interval_seconds}s</span>
                <span>300s</span>
              </div>
            </div>

            {/* Job Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Minimum Jobs
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.min_jobs}
                  onChange={(e) => setConfig({ ...config, min_jobs: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Maximum Jobs
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={config.max_jobs}
                  onChange={(e) => setConfig({ ...config, max_jobs: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Hot Lot Probability */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hot Lot Probability
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.hot_lot_probability}
                onChange={(e) => setConfig({ ...config, hot_lot_probability: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0%</span>
                <span className="font-medium text-slate-900">
                  {(config.hot_lot_probability * 100).toFixed(0)}%
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'distribution' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Adjust the probability distribution for job priority levels
            </p>
            
            {Object.entries(config.priority_distribution)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([priority, probability]) => (
                <div key={priority} className="flex items-center gap-4">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${
                    priority === '1' ? 'bg-red-100 text-red-700' :
                    priority === '2' ? 'bg-orange-100 text-orange-700' :
                    priority === '3' ? 'bg-yellow-100 text-yellow-700' :
                    priority === '4' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    P{priority}
                  </span>
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={probability}
                      onChange={(e) => updatePriorityDist(priority, parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium">
                    {(probability * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Note: Priority 1 is always used for hot lots regardless of this distribution.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-sm text-slate-500 sticky top-0 bg-white pb-2">
              Adjust relative weights for customer job generation frequency
            </p>
            
            {Object.entries(config.customer_weights)
              .sort(([, a], [, b]) => b - a)
              .map(([customer, weight]) => (
                <div key={customer} className="flex items-center gap-4">
                  <span className="w-24 text-sm font-medium text-slate-700 truncate">
                    {customer}
                  </span>
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.1"
                      value={weight}
                      onChange={(e) => updateCustomerWeight(customer, parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <span className="w-10 text-right text-sm text-slate-500">
                    {weight.toFixed(1)}x
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <button
          onClick={generateTestJob}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Zap className="w-4 h-4" />
          Test Generate
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={saveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default AutonomousJobConfig;