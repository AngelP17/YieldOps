import type { SPCViolation } from '../lib/spcEngine';

interface SPCViolationBadgesProps {
  violations: SPCViolation[];
}

const RULE_LABELS: Record<number, string> = {
  1: 'Beyond 3σ',
  2: '2/3 beyond 2σ',
  3: '4/5 beyond 1σ',
  4: '8-pt Run',
};

export function SPCViolationBadges({ violations }: SPCViolationBadgesProps) {
  if (violations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-medium text-emerald-700">Process In Control</span>
      </div>
    );
  }

  // Group by rule
  const countByRule = new Map<number, { count: number; severity: 'warning' | 'critical' }>();
  for (const v of violations) {
    const existing = countByRule.get(v.ruleId);
    if (existing) {
      existing.count++;
    } else {
      countByRule.set(v.ruleId, { count: 1, severity: v.severity });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-slate-500">Violations:</span>
      {Array.from(countByRule.entries()).map(([ruleId, { count, severity }]) => (
        <span
          key={ruleId}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            severity === 'critical'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          R{ruleId}: {RULE_LABELS[ruleId]} ({count})
        </span>
      ))}
    </div>
  );
}
