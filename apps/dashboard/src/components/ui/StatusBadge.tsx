export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    RUNNING: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    IDLE: 'bg-amber-100 text-amber-700 border-amber-200',
    DOWN: 'bg-rose-100 text-rose-700 border-rose-200',
    MAINTENANCE: 'bg-slate-100 text-slate-700 border-slate-200',
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    QUEUED: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
    FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.IDLE}`}>
      {status}
    </span>
  );
}

export function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    QUEUED: 'bg-blue-100 text-blue-700',
    RUNNING: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-slate-100 text-slate-700',
    FAILED: 'bg-rose-100 text-rose-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}
