import { useState, useEffect, useCallback } from 'react';
import {
  IconBook, 
  IconPlayerPlay, 
  IconDownload, 
  IconRefresh,
  IconExternalLink,
  IconFileTypeHtml,
  IconFileTypePdf,
  IconFileCode,
  IconPresentation,
  IconAlertCircle,
  IconLoader2
} from '@tabler/icons-react';
import { api, isApiConfigured, toApiUrl } from '../../services/apiClient';
import { useToast } from '../ui/Toast';

interface Notebook {
  name: string;
  path: string;
  description?: string;
  last_modified?: string | number;
}

interface Scenario {
  name: string;
  description: string;
  params: Record<string, number>;
}

interface Report {
  name: string;
  path: string;
  created_at: string | number;
  size_bytes: number;
  format: string;
}

const EXPORT_FORMATS = [
  { id: 'html', label: 'HTML', icon: IconFileTypeHtml, description: 'Interactive web page' },
  { id: 'pdf', label: 'PDF', icon: IconFileTypePdf, description: 'Static document' },
  { id: 'script', label: 'Python Script', icon: IconFileCode, description: 'Executable .py file' },
  { id: 'slides', label: 'Slides', icon: IconPresentation, description: 'Reveal.js presentation' },
];

const DEMO_NOTEBOOKS: Notebook[] = [
  { name: 'yield_forecast_30d.ipynb', path: '/demo/yield_forecast_30d.ipynb', description: '30-day demand and yield forecast' },
  { name: 'capacity_bottleneck_scan.ipynb', path: '/demo/capacity_bottleneck_scan.ipynb', description: 'Bottleneck and throughput simulation' },
  { name: 'sentinel_incident_review.ipynb', path: '/demo/sentinel_incident_review.ipynb', description: 'Incident trend analysis for sentinel alerts' },
];

const DEMO_SCENARIOS: Record<string, Scenario> = {
  base: { name: 'Base Case', description: 'Balanced demand and stable tool health', params: { demand_growth: 1.0, yield_target: 0.9 } },
  stress: { name: 'Stress', description: 'High volume with constrained dispatch capacity', params: { demand_growth: 1.2, yield_target: 0.86 } },
  recovery: { name: 'Recovery', description: 'Post-incident ramp with controlled WIP', params: { demand_growth: 0.95, yield_target: 0.92 } },
};

const DEMO_REPORTS: Report[] = [
  {
    name: 'yield-forecast-demo.html',
    path: '/demo/reports/yield-forecast-demo.html',
    created_at: Date.now() - 1000 * 60 * 45,
    size_bytes: 248_120,
    format: 'html',
  },
  {
    name: 'sentinel-review-demo.pdf',
    path: '/demo/reports/sentinel-review-demo.pdf',
    created_at: Date.now() - 1000 * 60 * 90,
    size_bytes: 982_304,
    format: 'pdf',
  },
];

export function NotebooksTab() {
  const { toast } = useToast();
  const apiAvailable = isApiConfigured();
  const [activeSection, setActiveSection] = useState<'execute' | 'export' | 'sync' | 'reports'>('execute');
  
  // Notebooks list
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loadingNotebooks, setLoadingNotebooks] = useState(true);
  
  // Scenarios
  const [scenarios, setScenarios] = useState<Record<string, Scenario>>({});
  const [selectedNotebook, setSelectedNotebook] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('base');
  const [customParams, setCustomParams] = useState('');
  const [executing, setExecuting] = useState(false);
  
  // Export
  const [selectedExportFormat, setSelectedExportFormat] = useState('html');
  const [exporting, setExporting] = useState(false);
  
  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState('both');
  
  // Reports
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  
  // Jupyter
  const [launchingJupyter, setLaunchingJupyter] = useState(false);

  // Load notebooks and scenarios
  const loadData = useCallback(async () => {
    if (!apiAvailable) {
      setLoadingNotebooks(false);
      setNotebooks(DEMO_NOTEBOOKS);
      setScenarios(DEMO_SCENARIOS);
      if (!selectedNotebook && DEMO_NOTEBOOKS.length > 0) {
        setSelectedNotebook(DEMO_NOTEBOOKS[0].name);
      }
      return;
    }

    try {
      setLoadingNotebooks(true);
      const [notebooksData, scenariosData] = await Promise.all([
        api.getNotebooks(),
        api.getNotebookScenarios()
      ]);
      setNotebooks(notebooksData);
      setScenarios(scenariosData);
      if (notebooksData.length > 0 && !selectedNotebook) {
        setSelectedNotebook(notebooksData[0].name);
      }
    } catch (err) {
      toast('Failed to load notebooks', 'error');
    } finally {
      setLoadingNotebooks(false);
    }
  }, [apiAvailable, toast, selectedNotebook]);

  // Load reports
  const loadReports = useCallback(async () => {
    if (!apiAvailable) {
      setLoadingReports(false);
      setReports(DEMO_REPORTS);
      return;
    }

    try {
      setLoadingReports(true);
      const reportsData = await api.getNotebookReports();
      setReports(reportsData);
    } catch (err) {
      toast('Failed to load reports', 'error');
    } finally {
      setLoadingReports(false);
    }
  }, [apiAvailable, toast]);

  useEffect(() => {
    loadData();
    loadReports();
  }, [loadData, loadReports]);

  // Execute notebook
  const handleExecute = async () => {
    if (!selectedNotebook) {
      toast('Please select a notebook', 'error');
      return;
    }
    
    setExecuting(true);

    if (!apiAvailable) {
      const demoReport: Report = {
        name: `${selectedNotebook.replace('.ipynb', '')}-${selectedScenario}-demo.html`,
        path: `/demo/reports/${selectedNotebook.replace('.ipynb', '')}-${selectedScenario}-demo.html`,
        created_at: Date.now(),
        size_bytes: 320_000,
        format: 'html',
      };
      setReports((prev) => [demoReport, ...prev.filter((r) => r.name !== demoReport.name)]);
      toast('Notebook executed in demo mode (simulated)', 'success');
      setExecuting(false);
      return;
    }

    try {
      let params = undefined;
      if (selectedScenario === 'custom' && customParams.trim()) {
        try {
          params = JSON.parse(customParams);
        } catch {
          toast('Invalid JSON in custom parameters', 'error');
          setExecuting(false);
          return;
        }
      }
      
      const result = await api.executeNotebook({
        notebook_name: selectedNotebook,
        scenario: selectedScenario,
        custom_params: params
      });
      
      if (result.success) {
        toast(result.message, 'success');
        loadReports(); // Refresh reports list
      } else {
        toast(result.message, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      toast(message, 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Export notebook
  const handleExport = async () => {
    if (!selectedNotebook) {
      toast('Please select a notebook', 'error');
      return;
    }
    
    setExporting(true);

    if (!apiAvailable) {
      const demoExt = selectedExportFormat === 'script' ? 'py' : selectedExportFormat;
      const demoReport: Report = {
        name: `${selectedNotebook.replace('.ipynb', '')}-demo.${demoExt}`,
        path: `/demo/reports/${selectedNotebook.replace('.ipynb', '')}-demo.${demoExt}`,
        created_at: Date.now(),
        size_bytes: 180_000,
        format: demoExt,
      };
      setReports((prev) => [demoReport, ...prev.filter((r) => r.name !== demoReport.name)]);
      toast(`Export simulated in demo mode (${demoExt.toUpperCase()})`, 'success');
      setExporting(false);
      return;
    }

    try {
      const result = await api.exportNotebook({
        notebook_name: selectedNotebook,
        format: selectedExportFormat
      });
      
      if (result.success) {
        toast(`Exported to ${selectedExportFormat.toUpperCase()}`, 'success');
        loadReports();
      } else {
        toast(result.message, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast(message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Sync notebooks
  const handleSync = async () => {
    setSyncing(true);

    if (!apiAvailable) {
      toast('Sync simulated in demo mode', 'success');
      setSyncing(false);
      return;
    }

    try {
      const result = await api.syncNotebooks({ direction: syncDirection });
      if (result.success) {
        toast(result.message, 'success');
        loadData(); // Refresh notebooks list
      } else {
        toast(result.message, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      toast(message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Launch Jupyter
  const handleLaunchJupyter = async () => {
    setLaunchingJupyter(true);

    if (!apiAvailable) {
      toast('Jupyter launch is disabled in demo mode (no backend)', 'info');
      setLaunchingJupyter(false);
      return;
    }

    try {
      const result = await api.launchJupyter();
      if (result.success) {
        toast(result.message, 'success');
        if (result.url) {
          const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (!isLocalHost && result.url.includes('localhost')) {
            toast('Jupyter URL is local-only and is not reachable from this deployed app', 'error');
            return;
          }
          window.open(result.url, '_blank');
        }
      } else {
        toast(result.message, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to launch Jupyter';
      toast(message, 'error');
    } finally {
      setLaunchingJupyter(false);
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (value: string | number) => {
    if (typeof value === 'number') {
      return new Date(value * 1000).toLocaleString();
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString();
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <IconBook className="w-5 h-5 text-blue-600" />
            Notebooks
          </h2>
          <p className="text-sm text-slate-500">
            {apiAvailable
              ? 'Execute, export, and manage Jupyter notebooks with Papermill'
              : 'Demo mode: notebook workflows are simulated with seeded sample outputs'}
          </p>
        </div>
        <button
          onClick={handleLaunchJupyter}
          disabled={launchingJupyter}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {launchingJupyter ? (
            <IconLoader2 className="w-4 h-4 animate-spin" />
          ) : (
            <IconExternalLink className="w-4 h-4" />
          )}
          Launch Jupyter Lab
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
        {[
          { id: 'execute', label: 'Execute', icon: IconPlayerPlay },
          { id: 'export', label: 'Export', icon: IconDownload },
          { id: 'sync', label: 'Sync', icon: IconRefresh },
          { id: 'reports', label: 'Reports', icon: IconBook },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeSection === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Execute Section */}
      {activeSection === 'execute' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Execute Notebook</h3>
            
            {/* Notebook Selection */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Select Notebook</label>
                {loadingNotebooks ? (
                  <div className="flex items-center gap-2 text-slate-500 py-2">
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    Loading notebooks...
                  </div>
                ) : notebooks.length === 0 ? (
                  <div className="text-sm text-slate-500 py-2">No notebooks found</div>
                ) : (
                  <select
                    value={selectedNotebook}
                    onChange={(e) => setSelectedNotebook(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {notebooks.map((nb) => (
                      <option key={nb.name} value={nb.name}>
                        {nb.name}
                        {nb.description && ` - ${nb.description.substring(0, 50)}...`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scenario Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Scenario</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(scenarios).map(([key, scenario]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedScenario(key)}
                      className={`p-3 text-left rounded-lg border transition-all ${
                        selectedScenario === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{scenario.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{scenario.description}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedScenario('custom')}
                    className={`p-3 text-left rounded-lg border transition-all ${
                      selectedScenario === 'custom'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900">Custom</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Define your own parameters</div>
                  </button>
                </div>
              </div>

              {/* Custom Params */}
              {selectedScenario === 'custom' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Custom Parameters (JSON)</label>
                  <textarea
                    value={customParams}
                    onChange={(e) => setCustomParams(e.target.value)}
                    placeholder='{"demand_growth": 1.1, "yield_target": 0.95}'
                    rows={4}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={handleExecute}
                disabled={executing || !selectedNotebook || loadingNotebooks}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {executing ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    Executing with {scenarios[selectedScenario]?.name || 'Custom'}...
                  </>
                ) : (
                  <>
                    <IconPlayerPlay className="w-4 h-4" />
                    Execute Notebook
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Section */}
      {activeSection === 'export' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Export Notebook</h3>
            
            <div className="space-y-4">
              {/* Notebook Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Select Notebook</label>
                <select
                  value={selectedNotebook}
                  onChange={(e) => setSelectedNotebook(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {notebooks.map((nb) => (
                    <option key={nb.name} value={nb.name}>{nb.name}</option>
                  ))}
                </select>
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Export Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setSelectedExportFormat(format.id)}
                      className={`p-3 rounded-lg border transition-all flex items-center gap-3 ${
                        selectedExportFormat === format.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <format.icon className="w-5 h-5 text-slate-600" />
                      <div className="text-left">
                        <div className="text-xs font-semibold text-slate-900">{format.label}</div>
                        <div className="text-[10px] text-slate-500">{format.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={exporting || !selectedNotebook}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <IconDownload className="w-4 h-4" />
                    Export to {EXPORT_FORMATS.find(f => f.id === selectedExportFormat)?.label}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Section */}
      {activeSection === 'sync' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Sync Notebooks</h3>
            <p className="text-xs text-slate-500 mb-4">
              Bidirectional sync between .ipynb notebooks and .py scripts using Jupytext
            </p>
            
            <div className="space-y-4">
              {/* Direction Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Sync Direction</label>
                <div className="flex gap-2">
                  {[
                    { id: 'both', label: 'Both Ways', desc: 'Sync in both directions' },
                    { id: 'to_scripts', label: 'To Scripts', desc: 'Notebooks → .py files' },
                    { id: 'to_notebooks', label: 'To Notebooks', desc: '.py files → Notebooks' },
                  ].map((dir) => (
                    <button
                      key={dir.id}
                      onClick={() => setSyncDirection(dir.id)}
                      className={`flex-1 p-3 rounded-lg border transition-all text-left ${
                        syncDirection === dir.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{dir.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{dir.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sync Button */}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {syncing ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-4 h-4" />
                    Sync {syncDirection === 'both' ? 'Both Ways' : syncDirection === 'to_scripts' ? 'to Scripts' : 'to Notebooks'}
                  </>
                )}
              </button>

              {/* Info Box */}
              <div className="p-3 bg-slate-50 rounded-lg flex items-start gap-2">
                <IconAlertCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="text-xs text-slate-600">
                  <strong>Jupytext</strong> allows bidirectional synchronization between Jupyter notebooks 
                  and plain Python scripts. Changes made in either format will be reflected in the other.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Section */}
      {activeSection === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Generated Reports</h3>
            <button
              onClick={loadReports}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
          </div>
          
          {loadingReports ? (
            <div className="p-8 text-center">
              <IconLoader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-500">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <IconBook className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No reports generated yet</p>
              <p className="text-xs text-slate-400 mt-1">Execute a notebook to create your first report</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((report) => (
                <div key={report.name} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    {report.format === 'html' && <IconFileTypeHtml className="w-5 h-5 text-orange-500" />}
                    {report.format === 'pdf' && <IconFileTypePdf className="w-5 h-5 text-red-500" />}
                    {report.format === 'py' && <IconFileCode className="w-5 h-5 text-blue-500" />}
                    {report.format === 'ipynb' && <IconBook className="w-5 h-5 text-indigo-500" />}
                    {!['html', 'pdf', 'py', 'ipynb'].includes(report.format) && <IconFileCode className="w-5 h-5 text-slate-400" />}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{report.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(report.created_at)} • {formatSize(report.size_bytes)}
                      </p>
                    </div>
                  </div>
                  {apiAvailable ? (
                    <a
                      href={toApiUrl(`/api/v1/notebooks/reports/${encodeURIComponent(report.name)}`)}
                      download
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <IconDownload className="w-3 h-3" />
                      Download
                    </a>
                  ) : (
                    <span className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg">
                      Demo file
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
