import { 
  IconBuildingFactory, 
  IconPackage, 
  IconWind, 
  IconCheck,
  IconAlertTriangle
} from '@tabler/icons-react';

interface AgentCoveragePanelProps {
  facilitySummary?: {
    total_ffus: number;
    critical_ffus: number;
    avg_pressure_drop_pa: number;
    max_particle_count: number;
    iso_compliant_zones: number;
  } | null;
  assemblySummary?: {
    total_bonders: number;
    warning_bonders: number;
    avg_oee_percent: number;
    total_nsop_24h: number;
    avg_bond_time_ms: number;
  } | null;
}

export function AgentCoveragePanel({ facilitySummary, assemblySummary }: AgentCoveragePanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <IconBuildingFactory className="w-4 h-4 text-blue-600" />
          Sand-to-Package Coverage
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Full value chain: Front-End Fab → Back-End Packaging
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Front-End: Facility Agent */}
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <IconWind className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Front-End: Facility Agent</h4>
              <p className="text-xs text-slate-500">Cleanroom & Environment</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">FFU Units</span>
              <span className="font-medium text-slate-900">
                {facilitySummary?.total_ffus ?? '-'}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">ISO Compliant Zones</span>
              <span className={`font-medium ${
                (facilitySummary?.iso_compliant_zones ?? 0) > 0 
                  ? 'text-emerald-600' 
                  : 'text-slate-400'
              }`}>
                {facilitySummary?.iso_compliant_zones ?? '-'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Avg Pressure Drop</span>
              <span className="font-medium text-slate-900">
                {facilitySummary?.avg_pressure_drop_pa 
                  ? `${facilitySummary.avg_pressure_drop_pa.toFixed(1)} Pa` 
                  : '-'}
              </span>
            </div>

            {facilitySummary && facilitySummary.critical_ffus > 0 && (
              <div className="flex items-center gap-2 p-2 bg-rose-50 rounded-lg">
                <IconAlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-xs text-rose-700">
                  {facilitySummary.critical_ffus} FFU(s) require attention
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
              Protocol Stack
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                Modbus/BACnet
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                ISO 14644-1
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                Bernoulli Flow
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            <span className="font-medium text-blue-600">Physics:</span> Darcy-Weisbach filter impedance detection
          </div>
        </div>

        {/* Back-End: Assembly Agent */}
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <IconPackage className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Back-End: Assembly Agent</h4>
              <p className="text-xs text-slate-500">Wire Bonding & Packaging</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Wire Bonders</span>
              <span className="font-medium text-slate-900">
                {assemblySummary?.total_bonders ?? '-'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Avg OEE</span>
              <span className={`font-medium ${
                (assemblySummary?.avg_oee_percent ?? 0) >= 85 
                  ? 'text-emerald-600' 
                  : (assemblySummary?.avg_oee_percent ?? 0) >= 70 
                    ? 'text-amber-600'
                    : 'text-rose-600'
              }`}>
                {assemblySummary?.avg_oee_percent 
                  ? `${assemblySummary.avg_oee_percent.toFixed(1)}%` 
                  : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">NSOP (24h)</span>
              <span className={`font-medium ${
                (assemblySummary?.total_nsop_24h ?? 0) === 0 
                  ? 'text-emerald-600' 
                  : 'text-rose-600'
              }`}>
                {assemblySummary?.total_nsop_24h ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Avg Bond Time</span>
              <span className="font-medium text-slate-900">
                {assemblySummary?.avg_bond_time_ms 
                  ? `${assemblySummary.avg_bond_time_ms.toFixed(1)} ms` 
                  : '-'}
              </span>
            </div>

            {assemblySummary && assemblySummary.warning_bonders > 0 && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                <IconAlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-700">
                  {assemblySummary.warning_bonders} bonder(s) showing warnings
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
              Protocol Stack
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                SECS/GEM
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                S2F41 Host Cmd
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                Ultrasonic Impedance
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            <span className="font-medium text-purple-600">Physics:</span> USG impedance for NSOP detection
          </div>
        </div>
      </div>

      {/* Interview Talking Points */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
          Interview Talking Points
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <IconCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <span>
              <strong>Front-End (Fab):</strong> HEPA filter end-of-life prediction via P/Q impedance before airflow drops
            </span>
          </div>
          <div className="flex items-start gap-2">
            <IconCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <span>
              <strong>Back-End (Packaging):</strong> NSOP detection in milliseconds prevents thousands of bad units
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
