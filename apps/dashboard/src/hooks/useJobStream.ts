/**
 * Real-time Job Stream Hook
 * 
 * Provides live job streaming with Supabase Realtime for instant updates
 * across web and mobile interfaces without page refresh.
 * 
 * Features:
 * - Real-time INSERT/UPDATE/DELETE events via Supabase
 * - Automatic reconnection handling
 * - Job arrival notifications
 * - Optimistic updates
 * - Mobile-optimized batching
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase, type DatabaseProductionJob } from '../services/supabaseClient';
import type { ProductionJob } from '../types';

export interface JobStreamEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  job: ProductionJob;
  timestamp: number;
  source: 'realtime' | 'cache' | 'optimistic';
}

export interface JobStreamStats {
  totalJobs: number;
  pendingJobs: number;
  queuedJobs: number;
  runningJobs: number;
  hotLots: number;
  recentArrivals: number;
}

export interface UseJobStreamOptions {
  enabled?: boolean;
  statusFilter?: ('PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED')[];
  includeHistory?: boolean;
  historyHours?: number;
  onJobArrival?: (job: ProductionJob) => void;
  onJobComplete?: (job: ProductionJob) => void;
  batchUpdates?: boolean;
  batchInterval?: number;
}

// Convert database job to app job type
function mapDatabaseJob(dbJob: DatabaseProductionJob): ProductionJob {
  return {
    job_id: dbJob.job_id,
    job_name: dbJob.job_name,
    wafer_count: dbJob.wafer_count,
    priority_level: dbJob.priority_level,
    status: dbJob.status,
    recipe_type: dbJob.recipe_type,
    assigned_machine_id: dbJob.assigned_machine_id,
    estimated_duration_minutes: dbJob.estimated_duration_minutes,
    actual_start_time: dbJob.actual_start_time,
    actual_end_time: dbJob.actual_end_time,
    deadline: dbJob.deadline,
    customer_tag: dbJob.customer_tag,
    is_hot_lot: dbJob.is_hot_lot,
    created_at: dbJob.created_at,
    updated_at: dbJob.updated_at,
  };
}

export function useJobStream(options: UseJobStreamOptions = {}) {
  const {
    enabled = true,
    statusFilter = ['PENDING', 'QUEUED', 'RUNNING'],
    includeHistory = true,
    historyHours = 24,
    onJobArrival,
    onJobComplete,
    batchUpdates = false,
    batchInterval = 100,
  } = options;

  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [events, setEvents] = useState<JobStreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Batch processing refs
  const pendingUpdatesRef = useRef<ProductionJob[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Calculate stats
  const stats: JobStreamStats = useMemo(() => {
    const now = Date.now();
    const recentThreshold = now - 5 * 60 * 1000; // 5 minutes
    
    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === 'PENDING').length,
      queuedJobs: jobs.filter(j => j.status === 'QUEUED').length,
      runningJobs: jobs.filter(j => j.status === 'RUNNING').length,
      hotLots: jobs.filter(j => j.is_hot_lot).length,
      recentArrivals: jobs.filter(j => new Date(j.created_at).getTime() > recentThreshold).length,
    };
  }, [jobs]);

  // Process batched updates
  const processBatch = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return;
    
    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current = [];
    
    setJobs(prev => {
      const jobMap = new Map(prev.map(j => [j.job_id, j]));
      
      updates.forEach(job => {
        jobMap.set(job.job_id, job);
      });
      
      return Array.from(jobMap.values())
        .filter(j => statusFilter.includes(j.status))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
  }, [statusFilter]);

  // Schedule batch update
  const scheduleBatchUpdate = useCallback((job: ProductionJob) => {
    pendingUpdatesRef.current.push(job);
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(processBatch, batchInterval);
  }, [batchInterval, processBatch]);

  // Handle realtime events
  const handleRealtimeEvent = useCallback((payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: DatabaseProductionJob;
    old: DatabaseProductionJob;
  }) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'DELETE') {
      setJobs(prev => prev.filter(j => j.job_id !== oldRecord.job_id));
      const event: JobStreamEvent = {
        type: 'DELETE',
        job: mapDatabaseJob(oldRecord),
        timestamp: Date.now(),
        source: 'realtime',
      };
      setEvents(prev => [event, ...prev].slice(0, 100));
      return;
    }

    const job = mapDatabaseJob(newRecord);
    
    // Check if job matches status filter
    const matchesFilter = statusFilter.includes(job.status);
    
    if (eventType === 'INSERT') {
      if (matchesFilter) {
        if (batchUpdates) {
          scheduleBatchUpdate(job);
        } else {
          setJobs(prev => [job, ...prev].filter(j => statusFilter.includes(j.status)));
        }
        
        // Trigger arrival callback
        onJobArrival?.(job);
        
        const event: JobStreamEvent = {
          type: 'INSERT',
          job,
          timestamp: Date.now(),
          source: 'realtime',
        };
        setEvents(prev => [event, ...prev].slice(0, 100));
      }
    } else if (eventType === 'UPDATE') {
      // Check for completion
      if (oldRecord.status !== 'COMPLETED' && newRecord.status === 'COMPLETED') {
        onJobComplete?.(job);
      }
      
      if (matchesFilter) {
        if (batchUpdates) {
          scheduleBatchUpdate(job);
        } else {
          setJobs(prev => {
            const exists = prev.some(j => j.job_id === job.job_id);
            if (exists) {
              return prev.map(j => j.job_id === job.job_id ? job : j)
                .filter(j => statusFilter.includes(j.status));
            } else {
              return [job, ...prev].filter(j => statusFilter.includes(j.status));
            }
          });
        }
        
        const event: JobStreamEvent = {
          type: 'UPDATE',
          job,
          timestamp: Date.now(),
          source: 'realtime',
        };
        setEvents(prev => [event, ...prev].slice(0, 100));
      } else {
        // Remove if no longer matches filter
        setJobs(prev => prev.filter(j => j.job_id !== job.job_id));
      }
    }
  }, [statusFilter, batchUpdates, scheduleBatchUpdate, onJobArrival, onJobComplete]);

  // Fetch initial jobs
  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('production_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Apply status filter
      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }
      
      // Apply time filter for history
      if (includeHistory && historyHours) {
        const cutoff = new Date(Date.now() - historyHours * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', cutoff);
      }
      
      const { data, error: queryError } = await query;
      
      if (queryError) throw queryError;
      
      const mappedJobs = (data || []).map(mapDatabaseJob);
      setJobs(mappedJobs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch jobs'));
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, includeHistory, historyHours]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    // Fetch initial data
    fetchJobs();

    // Setup realtime subscription
    channelRef.current = supabase
      .channel('job-stream')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        handleRealtimeEvent as any
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          setError(new Error('Realtime channel error'));
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [enabled, fetchJobs, handleRealtimeEvent]);

  // Optimistic update helpers
  const addOptimisticJob = useCallback((job: ProductionJob) => {
    setJobs(prev => [job, ...prev]);
    const event: JobStreamEvent = {
      type: 'INSERT',
      job,
      timestamp: Date.now(),
      source: 'optimistic',
    };
    setEvents(prev => [event, ...prev].slice(0, 100));
  }, []);

  const updateOptimisticJob = useCallback((jobId: string, updates: Partial<ProductionJob>) => {
    setJobs(prev => prev.map(j => 
      j.job_id === jobId ? { ...j, ...updates, updated_at: new Date().toISOString() } : j
    ));
  }, []);

  const removeOptimisticJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(j => j.job_id !== jobId));
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    events,
    stats,
    isConnected,
    isLoading,
    error,
    refresh,
    addOptimisticJob,
    updateOptimisticJob,
    removeOptimisticJob,
  };
}

// Specialized hook for job arrival notifications
export function useJobArrivals(options: {
  enabled?: boolean;
  onHotLot?: (job: ProductionJob) => void;
  onStandardJob?: (job: ProductionJob) => void;
} = {}) {
  const { enabled = true, onHotLot, onStandardJob } = options;
  const [recentArrivals, setRecentArrivals] = useState<ProductionJob[]>([]);
  const processedIds = useRef<Set<string>>(new Set());

  const { jobs, isConnected } = useJobStream({
    enabled,
    statusFilter: ['PENDING', 'QUEUED'],
    includeHistory: true,
    historyHours: 1, // Only look at last hour
    onJobArrival: (job) => {
      if (processedIds.current.has(job.job_id)) return;
      processedIds.current.add(job.job_id);
      
      // Keep only last 100 IDs to prevent memory leak
      if (processedIds.current.size > 100) {
        const iterator = processedIds.current.values();
        const firstValue = iterator.next().value;
        if (firstValue) {
          processedIds.current.delete(firstValue);
        }
      }
      
      if (job.is_hot_lot) {
        onHotLot?.(job);
      } else {
        onStandardJob?.(job);
      }
      
      setRecentArrivals(prev => [job, ...prev].slice(0, 10));
    },
  });

  // Clear processed IDs when disconnected to re-process on reconnect
  useEffect(() => {
    if (!isConnected) {
      processedIds.current.clear();
    }
  }, [isConnected]);

  return {
    recentArrivals,
    isConnected,
    pendingCount: jobs.filter(j => j.status === 'PENDING').length,
    hotLotCount: jobs.filter(j => j.is_hot_lot && j.status === 'PENDING').length,
  };
}

// Hook for watching a specific job
export function useJobWatcher(jobId: string | null, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !jobId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch initial job data
    const fetchJob = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('production_jobs')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (queryError) throw queryError;
        
        setJob(data ? mapDatabaseJob(data) : null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch job'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();

    // Subscribe to changes
    const channelName = jobId ? `job-${jobId}` : 'job-watcher';
    const filterValue = jobId ? `job_id=eq.${jobId}` : '';
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
          filter: filterValue || undefined,
        } as any,
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            setJob(null);
          } else {
            setJob(mapDatabaseJob(payload.new as DatabaseProductionJob));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, enabled]);

  return { job, isLoading, error };
}

export default useJobStream;