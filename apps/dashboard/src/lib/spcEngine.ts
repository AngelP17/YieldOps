/**
 * Statistical Process Control (SPC) Engine
 *
 * Implements Western Electric rules with correct same-side validation
 * for detecting out-of-control process conditions.
 */

export interface SPCStats {
  mean: number;
  std: number;
  ucl1: number; // mean + 1σ
  ucl2: number; // mean + 2σ
  ucl3: number; // mean + 3σ (UCL)
  lcl1: number; // mean - 1σ
  lcl2: number; // mean - 2σ
  lcl3: number; // mean - 3σ (LCL)
}

export type ZoneLabel = 'A+' | 'B+' | 'C+' | 'C-' | 'B-' | 'A-' | 'beyond+' | 'beyond-';

export interface SPCViolation {
  ruleId: 1 | 2 | 3 | 4;
  ruleName: string;
  description: string;
  index: number;
  severity: 'warning' | 'critical';
  side: 'upper' | 'lower';
}

export interface SPCDataPoint {
  index: number;
  value: number;
  zone: ZoneLabel;
  violations: SPCViolation[];
}

export interface SPCResult {
  stats: SPCStats;
  violations: SPCViolation[];
  data: SPCDataPoint[];
  cpk?: CPKResult;
}

export interface CPKResult {
  cpk: number;
  cpu: number;  // (USL - mean) / (3σ)
  cpl: number;  // (mean - LSL) / (3σ)
  rating: 'excellent' | 'good' | 'marginal' | 'poor';
}

function calculateStats(values: number[]): SPCStats {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    ucl1: mean + std,
    ucl2: mean + 2 * std,
    ucl3: mean + 3 * std,
    lcl1: mean - std,
    lcl2: mean - 2 * std,
    lcl3: mean - 3 * std,
  };
}

function getZone(value: number, stats: SPCStats): ZoneLabel {
  if (value > stats.ucl3) return 'beyond+';
  if (value < stats.lcl3) return 'beyond-';
  if (value > stats.ucl2) return 'A+';
  if (value < stats.lcl2) return 'A-';
  if (value > stats.ucl1) return 'B+';
  if (value < stats.lcl1) return 'B-';
  return value >= stats.mean ? 'C+' : 'C-';
}

/**
 * Rule 1: Any single point beyond 3σ (UCL/LCL)
 */
function checkRule1(values: number[], stats: SPCStats): SPCViolation[] {
  const violations: SPCViolation[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > stats.ucl3) {
      violations.push({
        ruleId: 1,
        ruleName: 'Beyond 3σ',
        description: 'Point beyond Upper Control Limit (3σ)',
        index: i,
        severity: 'critical',
        side: 'upper',
      });
    } else if (values[i] < stats.lcl3) {
      violations.push({
        ruleId: 1,
        ruleName: 'Beyond 3σ',
        description: 'Point beyond Lower Control Limit (3σ)',
        index: i,
        severity: 'critical',
        side: 'lower',
      });
    }
  }
  return violations;
}

/**
 * Rule 2: 2 of 3 consecutive points beyond 2σ on the SAME SIDE
 */
function checkRule2(values: number[], stats: SPCStats): SPCViolation[] {
  const violations: SPCViolation[] = [];
  for (let i = 2; i < values.length; i++) {
    const window = [values[i], values[i - 1], values[i - 2]];
    const aboveUCL2 = window.filter(v => v > stats.ucl2).length;
    const belowLCL2 = window.filter(v => v < stats.lcl2).length;

    if (aboveUCL2 >= 2) {
      violations.push({
        ruleId: 2,
        ruleName: '2 of 3 beyond 2σ',
        description: '2 of 3 points beyond 2σ Upper Zone A',
        index: i,
        severity: 'critical',
        side: 'upper',
      });
    } else if (belowLCL2 >= 2) {
      violations.push({
        ruleId: 2,
        ruleName: '2 of 3 beyond 2σ',
        description: '2 of 3 points beyond 2σ Lower Zone A',
        index: i,
        severity: 'critical',
        side: 'lower',
      });
    }
  }
  return violations;
}

/**
 * Rule 3: 4 of 5 consecutive points beyond 1σ on the SAME SIDE
 */
function checkRule3(values: number[], stats: SPCStats): SPCViolation[] {
  const violations: SPCViolation[] = [];
  for (let i = 4; i < values.length; i++) {
    const window = values.slice(i - 4, i + 1);
    const aboveUCL1 = window.filter(v => v > stats.ucl1).length;
    const belowLCL1 = window.filter(v => v < stats.lcl1).length;

    if (aboveUCL1 >= 4) {
      violations.push({
        ruleId: 3,
        ruleName: '4 of 5 beyond 1σ',
        description: '4 of 5 points beyond 1σ Upper Zone B (Trending High)',
        index: i,
        severity: 'warning',
        side: 'upper',
      });
    } else if (belowLCL1 >= 4) {
      violations.push({
        ruleId: 3,
        ruleName: '4 of 5 beyond 1σ',
        description: '4 of 5 points beyond 1σ Lower Zone B (Trending Low)',
        index: i,
        severity: 'warning',
        side: 'lower',
      });
    }
  }
  return violations;
}

/**
 * Rule 4: 8 consecutive points on the same side of the mean
 */
function checkRule4(values: number[], stats: SPCStats): SPCViolation[] {
  const violations: SPCViolation[] = [];
  for (let i = 7; i < values.length; i++) {
    const window = values.slice(i - 7, i + 1);
    const allAbove = window.every(v => v > stats.mean);
    const allBelow = window.every(v => v < stats.mean);

    if (allAbove) {
      violations.push({
        ruleId: 4,
        ruleName: '8-point run',
        description: '8 consecutive points above mean (Process Shift)',
        index: i,
        severity: 'warning',
        side: 'upper',
      });
    } else if (allBelow) {
      violations.push({
        ruleId: 4,
        ruleName: '8-point run',
        description: '8 consecutive points below mean (Process Shift)',
        index: i,
        severity: 'warning',
        side: 'lower',
      });
    }
  }
  return violations;
}

/**
 * Calculate CPK (Process Capability Index)
 * CPK = min(CPU, CPL) where:
 *   CPU = (USL - mean) / (3 * std)
 *   CPL = (mean - LSL) / (3 * std)
 * 
 * Rating thresholds:
 *   >= 1.67: excellent
 *   >= 1.33: good
 *   >= 1.00: marginal
 *   <  1.00: poor
 */
export function calculateCpk(mean: number, std: number, usl: number, lsl: number): CPKResult {
  const cpu = (usl - mean) / (3 * std);
  const cpl = (mean - lsl) / (3 * std);
  const cpk = Math.min(cpu, cpl);
  
  let rating: CPKResult['rating'];
  if (cpk >= 1.67) rating = 'excellent';
  else if (cpk >= 1.33) rating = 'good';
  else if (cpk >= 1.0) rating = 'marginal';
  else rating = 'poor';
  
  return { cpk, cpu, cpl, rating };
}

export interface AnalyzeSPCOptions {
  usl?: number;  // Upper Specification Limit
  lsl?: number;  // Lower Specification Limit
}

/**
 * Analyze a time series using SPC Western Electric rules.
 * Requires at least 10 data points for meaningful statistics.
 */
export function analyzeSPC(values: number[], options: AnalyzeSPCOptions = {}): SPCResult {
  if (values.length < 2) {
    const mean = values[0] ?? 0;
    return {
      stats: { mean, std: 0, ucl1: mean, ucl2: mean, ucl3: mean, lcl1: mean, lcl2: mean, lcl3: mean },
      violations: [],
      data: values.map((v, i) => ({ index: i, value: v, zone: 'C+' as ZoneLabel, violations: [] })),
    };
  }

  const stats = calculateStats(values);

  const allViolations = [
    ...checkRule1(values, stats),
    ...checkRule2(values, stats),
    ...checkRule3(values, stats),
    ...checkRule4(values, stats),
  ];

  // Build per-point violation lookup
  const violationsByIndex = new Map<number, SPCViolation[]>();
  for (const v of allViolations) {
    if (!violationsByIndex.has(v.index)) {
      violationsByIndex.set(v.index, []);
    }
    violationsByIndex.get(v.index)!.push(v);
  }

  const data: SPCDataPoint[] = values.map((value, index) => ({
    index,
    value,
    zone: getZone(value, stats),
    violations: violationsByIndex.get(index) ?? [],
  }));

  // Calculate CPK if spec limits provided
  let cpk: CPKResult | undefined;
  if (options.usl !== undefined && options.lsl !== undefined && stats.std > 0) {
    cpk = calculateCpk(stats.mean, stats.std, options.usl, options.lsl);
  }

  return { stats, violations: allViolations, data, cpk };
}
