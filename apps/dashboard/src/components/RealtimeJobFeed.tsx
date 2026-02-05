/**
 * Real-time Job Feed
 * 
 * Mobile-optimized job feed with real-time updates
 * Shows live job status changes as they happen
 */

import { useState, useRef } from 'react';
import {
  Clock,
  Flame,
  Package,
  Play,
  CheckCircle2,
  XCircle,
  Zap,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { useJobStream } from '../hooks/useJobStream';
import type { ProductionJob } from '../types';

interface RealtimeJobFeedProps {
  maxItems?: number;
  showFilters?: boolean;
  className?: string;
}

export function RealtimeJobFeed({
  maxItems = 20,
  showFilters = true,
  className = ''
}: RealtimeJobFeedProps) {
  const [statusFilter, setStatusFilter] = useState<string[]>(['PENDING', 'QUEUED', 'RUNNING']);
  const [sortBy, setSortBy] = useState<'created' | 'priority' | 'deadline'>('created');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasNewItems, setHasNewItems] = useState(false);

  const {
    jobs,
    events,
    stats,
    isConnected,
    isLoading,
    error,
    refresh
  } = useJobStream({
    enabled: true,
    statusFilter: statusFilter as ('PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED')[],
    batchUpdates: true,
    batchInterval: 150,
    onJobArrival: () => {
      // Show new items indicator if not at top
      if (scrollRef.current) {
        const { scrollTop } = scrollRef.current;
        if (scrollTop > 50) {
          setHasNewItems(true);
        }
      }
    },
  });

  // Clear new items indicator when scrolled to top
  const handleScroll = () => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 10) {
      setHasNewItems(false);
    }
  };

  // Sort jobs
  const sortedJobs = [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
        return a.priority_level - b.priority_level;
      case 'deadline':
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      case 'created':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  }).slice(0, maxItems);

  const displayedJobs = isExpanded ? sortedJobs : sortedJobs.slice(0, 5);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
              }`}>
              {isConnected ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Live Job Feed</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{stats.totalJobs} active</span>
                {stats.hotLots > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <Flame className="w-3 h-3" />
                    {stats.hotLots} hot
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(['PENDING', 'QUEUED', 'RUNNING'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(prev =>
                    prev.includes(status)
                      ? prev.filter(s => s !== status)
                      : [...prev, status]
                  );
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${statusFilter.includes(status)
                    ? status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      status === 'QUEUED' ? 'bg-blue-100 text-blue-700' :
                        'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {status}
                <span className="ml-1 opacity-75">
                  {status === 'PENDING' ? stats.pendingJobs :
                    status === 'QUEUED' ? stats.queuedJobs :
                      stats.runningJobs}
                </span>
              </button>
            ))}

            <div className="flex-1" />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created">Newest</option>
              <option value="priority">Priority</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>
        )}
      </div>

      {/* New items indicator */}
      {hasNewItems && (
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            setHasNewItems(false);
          }}
          className="sticky top-0 z-10 w-full py-2 bg-gradient-to-b from-blue-500 to-blue-600 text-white text-xs font-medium hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <ChevronDown className="w-4 h-4" />
          New jobs arrived
        </button>
      )}

      {/* Job list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[400px] overflow-y-auto"
      >
        {isLoading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <p className="text-sm">Failed to load jobs</p>
            <button
              onClick={refresh}
              className="mt-2 text-xs text-blue-500 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : displayedJobs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No jobs match filters</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedJobs.map((job, index) => (
              <JobFeedItem
                key={job.job_id}
                job={job}
                isNew={index < stats.recentArrivals}
              />
            ))}
          </div>
        )}

        {/* Show more/less */}
        {sortedJobs.length > 5 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-3 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
          >
            {isExpanded ? (
              <>
                Show less <ChevronDown className="w-3 h-3 rotate-180" />
              </>
            ) : (
              <>
                Show {sortedJobs.length - 5} more <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Recent activity footer */}
      {events.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Last activity: {getTimeAgo(events[0].timestamp)}
          </p>
        </div>
      )}
    </div>
  );
}

interface JobFeedItemProps {
  job: ProductionJob;
  isNew?: boolean;
}

function JobFeedItem({ job, isNew }: JobFeedItemProps) {
  const statusConfig = {
    PENDING: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Pending' },
    QUEUED: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Queued' },
    RUNNING: { icon: Play, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Running' },
    COMPLETED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Done' },
    FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
    CANCELLED: { icon: XCircle, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Cancelled' },
  };

  const status = statusConfig[job.status];
  const StatusIcon = status.icon;

  return (
    <div className={`px-4 py-3 hover:bg-slate-50 transition-colors ${isNew ? 'bg-blue-50/50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center`}>
          <StatusIcon className={`w-4 h-4 ${status.color}`} />
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-900 text-sm truncate">
              {job.job_name}
            </h4>
            {job.is_hot_lot && (
              <span className="flex-shrink-0 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                HOT
              </span>
            )}
            {isNew && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{job.customer_tag || 'Unknown'}</span>
            <span>•</span>
            <span>{job.wafer_count} wafers</span>
          </div>

          {/* Progress or meta info */}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${job.priority_level === 1 ? 'bg-red-100 text-red-700' :
                job.priority_level === 2 ? 'bg-orange-100 text-orange-700' :
                  job.priority_level === 3 ? 'bg-yellow-100 text-yellow-700' :
                    job.priority_level === 4 ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
              }`}>
              P{job.priority_level}
            </span>

            <span className="text-[10px] text-slate-400">
              {job.recipe_type}
            </span>

            {job.deadline && (
              <span className={`text-[10px] ${new Date(job.deadline) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                  ? 'text-red-500 font-medium'
                  : 'text-slate-400'
                }`}>
                Due {getTimeAgo(new Date(job.deadline).getTime(), true)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function
function getTimeAgo(timestamp: number, future = false): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (future) {
    const futureSeconds = -seconds;
    if (futureSeconds < 60) return 'soon';
    if (futureSeconds < 3600) return `in ${Math.floor(futureSeconds / 60)}m`;
    if (futureSeconds < 86400) return `in ${Math.floor(futureSeconds / 3600)}h`;
    return `in ${Math.floor(futureSeconds / 86400)}d`;
  }

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Mobile-optimized job feed for bottom sheet
export function MobileJobFeedSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 md:hidden max-h-[80vh]">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100">
          <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3" />
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Live Job Feed</h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
          <RealtimeJobFeed showFilters={false} className="border-0 rounded-none" />
        </div>
      </div>
    </>
  );
}

export default RealtimeJobFeed;