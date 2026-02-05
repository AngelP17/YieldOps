import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ElementType;
  trend: string;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';
}

const colorStyles = {
  blue: 'from-blue-500 to-blue-600 shadow-blue-200',
  emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-200',
  amber: 'from-amber-500 to-amber-600 shadow-amber-200',
  rose: 'from-rose-500 to-rose-600 shadow-rose-200',
  indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200',
  purple: 'from-purple-500 to-purple-600 shadow-purple-200',
};

export function KpiCard({ label, value, subtext, icon: Icon, trend, color }: KpiCardProps) {
  const isPositive = trend.startsWith('+');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${colorStyles[color]} shadow-lg`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend}
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-[10px] text-slate-400">{subtext}</p>
    </div>
  );
}
