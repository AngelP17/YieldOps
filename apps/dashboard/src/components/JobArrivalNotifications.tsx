/**
 * Job Arrival Notifications
 * 
 * Real-time notifications for new job arrivals
 * Optimized for both desktop and mobile
 * Includes hot lot alerts with priority indication
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  Zap, 
  Package, 
  X, 
  Bell,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useJobArrivals } from '../hooks/useJobStream';
import type { ProductionJob } from '../types';

interface Notification {
  id: string;
  job: ProductionJob;
  shownAt: number;
  type: 'hot-lot' | 'standard';
}

interface JobArrivalNotificationsProps {
  enabled?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
  autoDismiss?: boolean;
  dismissDelay?: number;
}

export function JobArrivalNotifications({
  enabled = true,
  position = 'top-right',
  maxNotifications = 3,
  autoDismiss = true,
  dismissDelay = 5000,
}: JobArrivalNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const handleHotLot = useCallback((job: ProductionJob) => {
    if (isPaused) return;
    
    const notification: Notification = {
      id: `hot-${job.job_id}-${Date.now()}`,
      job,
      shownAt: Date.now(),
      type: 'hot-lot',
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, maxNotifications));
  }, [isPaused, maxNotifications]);

  const handleStandardJob = useCallback((job: ProductionJob) => {
    if (isPaused) return;
    
    const notification: Notification = {
      id: `std-${job.job_id}-${Date.now()}`,
      job,
      shownAt: Date.now(),
      type: 'standard',
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, maxNotifications));
  }, [isPaused, maxNotifications]);

  const { pendingCount } = useJobArrivals({
    enabled,
    onHotLot: handleHotLot,
    onStandardJob: handleStandardJob,
  });

  // Auto-dismiss notifications
  useEffect(() => {
    if (!autoDismiss) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setNotifications(prev => 
        prev.filter(n => now - n.shownAt < dismissDelay)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [autoDismiss, dismissDelay]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissAll = () => {
    setNotifications([]);
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  if (notifications.length === 0) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50 hidden md:block`}>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-colors ${
            isPaused 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Live</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px]">
              {pendingCount}
            </span>
          )}

        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] md:w-80`}>
      {/* Header with dismiss all */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            isPaused 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {isPaused ? (
            <>
              <Clock className="w-3 h-3" />
              <span>Paused</span>
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              <span>Live Updates</span>
            </>
          )}
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {notifications.length} new
          </span>
          <button
            onClick={dismissAll}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onDismiss: () => void;
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  const { job, type } = notification;
  
  const isHotLot = type === 'hot-lot';
  
  return (
    <div 
      className={`relative overflow-hidden rounded-xl shadow-lg border animate-in slide-in-from-right fade-in duration-300 ${
        isHotLot 
          ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Hot lot indicator */}
      {isHotLot && (
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 to-orange-500" />
      )}
      
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
              isHotLot 
                ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-red-200' 
                : 'bg-blue-100 text-blue-600'
            }`}>
              <Package className="w-5 h-5" />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold text-sm ${isHotLot ? 'text-red-900' : 'text-slate-900'}`}>
                  {job.job_name}
                </h4>

              </div>
              
              <p className="text-xs text-slate-500 mt-0.5">
                {job.customer_tag || 'Unknown'} • {job.wafer_count} wafers
              </p>
              
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  job.priority_level === 1 ? 'bg-red-100 text-red-700' :
                  job.priority_level === 2 ? 'bg-orange-100 text-orange-700' :
                  job.priority_level === 3 ? 'bg-yellow-100 text-yellow-700' :
                  job.priority_level === 4 ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  P{job.priority_level}
                </span>
                <span className="text-xs text-slate-400">
                  {job.recipe_type}
                </span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onDismiss}
            className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress bar for auto-dismiss */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
          <div 
            className={`h-full ${isHotLot ? 'bg-red-400' : 'bg-blue-400'} animate-shrink`}
            style={{ animationDuration: '5s' }}
          />
        </div>
      </div>
    </div>
  );
}

// Compact version for mobile bottom sheet or header
// Accepts data via props instead of creating its own useJobStream instance
export function JobArrivalBadge({
  onClick,
  pendingCount = 0,
  isConnected = true,
  className = ''
}: {
  onClick?: () => void;
  pendingCount?: number;
  isConnected?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isConnected
          ? 'bg-slate-100 text-slate-600'
          : 'bg-amber-100 text-amber-700'
      } ${className}`}
    >
      {isConnected ? (
        <Zap className="w-3.5 h-3.5" />
      ) : (
        <Clock className="w-3.5 h-3.5" />
      )}

      <span className="hidden sm:inline">
        {isConnected ? 'Jobs' : 'Updates'}
      </span>

      {pendingCount > 0 && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px]">
          <Package className="w-2.5 h-2.5" />
          {pendingCount}
        </span>
      )}
    </button>
  );
}

// Job completion toast
export function JobCompletionToast({
  job,
  onDismiss,
}: {
  job: ProductionJob;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom fade-in">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-emerald-900 text-sm truncate">
              {job.job_name} Completed
            </h4>
            <p className="text-xs text-emerald-600">
              {job.wafer_count} wafers processed
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-emerald-400 hover:text-emerald-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default JobArrivalNotifications;