import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { analyzeSPC, type SPCResult } from '../lib/spcEngine';

interface SPCControlChartProps {
  data: Array<{ index: number; value: number }>;
  title: string;
  unit?: string;
  height?: number;
}

interface ChartDataPoint {
  index: number;
  value: number;
  violationValue?: number;
}

const ZONE_COLORS = {
  A: '#ffebee', // Red zone (2σ–3σ)
  B: '#fff3e0', // Orange zone (1σ–2σ)
  C: '#e8f5e9', // Green zone (mean–1σ)
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint & { zone?: string; violations?: string[] } }> }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-900">Point {point.index}</p>
      <p className="text-slate-600">Value: <span className="font-medium">{point.value?.toFixed(2)}</span></p>
      {point.zone && <p className="text-slate-500">Zone: {point.zone}</p>}
      {point.violations && point.violations.length > 0 && (
        <div className="mt-1 pt-1 border-t border-slate-100">
          {point.violations.map((v: string, i: number) => (
            <p key={i} className="text-rose-600 font-medium">{v}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function SPCControlChart({ data, title, unit = '', height = 240 }: SPCControlChartProps) {
  const spcResult: SPCResult = useMemo(
    () => analyzeSPC(data.map(d => d.value)),
    [data]
  );

  const { stats, violations } = spcResult;

  const chartData = useMemo(() => {
    return spcResult.data.map(point => ({
      index: point.index,
      value: point.value,
      violationValue: point.violations.length > 0 ? point.value : undefined,
      zone: point.zone,
      violations: point.violations.map(v => `Rule ${v.ruleId}: ${v.description}`),
    }));
  }, [spcResult]);

  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  // Y-axis domain with padding
  const allValues = data.map(d => d.value);
  const yMin = Math.min(...allValues, stats.lcl3) - stats.std * 0.5;
  const yMax = Math.max(...allValues, stats.ucl3) + stats.std * 0.5;

  return (
    <div className="bg-slate-50 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
              {warningCount} Warning
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
              In Control
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          {/* Zone shading - rendered first for correct z-order */}
          {/* Upper zones */}
          <ReferenceArea y1={stats.ucl2} y2={stats.ucl3} fill={ZONE_COLORS.A} fillOpacity={0.4} />
          <ReferenceArea y1={stats.ucl1} y2={stats.ucl2} fill={ZONE_COLORS.B} fillOpacity={0.3} />
          <ReferenceArea y1={stats.mean} y2={stats.ucl1} fill={ZONE_COLORS.C} fillOpacity={0.3} />
          {/* Lower zones (mirror) */}
          <ReferenceArea y1={stats.lcl1} y2={stats.mean} fill={ZONE_COLORS.C} fillOpacity={0.3} />
          <ReferenceArea y1={stats.lcl2} y2={stats.lcl1} fill={ZONE_COLORS.B} fillOpacity={0.3} />
          <ReferenceArea y1={stats.lcl3} y2={stats.lcl2} fill={ZONE_COLORS.A} fillOpacity={0.4} />

          {/* Reference lines */}
          <ReferenceLine
            y={stats.mean}
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray=""
            label={{ value: `X̄ ${stats.mean.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#3b82f6' }}
          />
          <ReferenceLine
            y={stats.ucl3}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="6 3"
            label={{ value: `UCL ${stats.ucl3.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#ef4444' }}
          />
          <ReferenceLine
            y={stats.lcl3}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="6 3"
            label={{ value: `LCL ${stats.lcl3.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#ef4444' }}
          />
          <ReferenceLine y={stats.ucl2} stroke="#f97316" strokeWidth={0.5} strokeDasharray="4 4" />
          <ReferenceLine y={stats.lcl2} stroke="#f97316" strokeWidth={0.5} strokeDasharray="4 4" />
          <ReferenceLine y={stats.ucl1} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2 4" />
          <ReferenceLine y={stats.lcl1} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2 4" />

          <XAxis
            dataKey="index"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            width={45}
            tickFormatter={(v: number) => `${v.toFixed(0)}${unit}`}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Data line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={(props: { cx: number; cy: number; payload: ChartDataPoint }) => {
              const hasViolation = props.payload.violationValue !== undefined;
              return (
                <circle
                  key={props.payload.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={hasViolation ? 5 : 2.5}
                  fill={hasViolation ? '#ef4444' : '#3b82f6'}
                  stroke={hasViolation ? '#fff' : 'none'}
                  strokeWidth={hasViolation ? 2 : 0}
                />
              );
            }}
            isAnimationActive={false}
          />

          {/* Violation points overlay */}
          <Scatter
            dataKey="violationValue"
            fill="#ef4444"
            shape={(props: unknown) => {
              const p = props as { cx: number; cy: number };
              return (
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={8}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />
              );
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Zone legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: ZONE_COLORS.C, opacity: 0.6 }} />
          <span>Zone C (1σ)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: ZONE_COLORS.B, opacity: 0.6 }} />
          <span>Zone B (2σ)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: ZONE_COLORS.A, opacity: 0.6 }} />
          <span>Zone A (3σ)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Violation</span>
        </div>
      </div>
    </div>
  );
}
