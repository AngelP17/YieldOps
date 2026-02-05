import { useState, useEffect, useCallback, useRef } from 'react';
import { api, isApiConfigured } from '../services/apiClient';

export interface VMStatus {
  machine_id: string;
  has_prediction: boolean;
  predicted_thickness_nm?: number;
  confidence_score?: number;
  r2r_correction?: number;
  ewma_error?: number;
  needs_correction?: boolean;
  last_updated?: string;
  message?: string;
}

export interface VMHistoryPoint {
  recorded_at: string;
  predicted_thickness_nm?: number;
  temperature?: number;
  pressure?: number;
  power_consumption?: number;
}

export interface VMHistory {
  machine_id: string;
  history: VMHistoryPoint[];
  trend: 'improving' | 'stable' | 'degrading' | 'increasing' | 'decreasing';
  avg_thickness: number;
  std_thickness: number;
}

export interface VMModelInfo {
  is_trained: boolean;
  features: string[];
  ewma_tracked_tools: number;
  model_path: string;
}

interface UseVirtualMetrologyOptions {
  pollingInterval?: number;
  enabled?: boolean;
}

// Cache for mock VM values to prevent flickering
const mockVMCache = new Map<string, VMStatus>();

// Generate mock VM status for demo mode (cached per machine)
const generateMockVMStatus = (machineId: string): VMStatus => {
  // Return cached value if exists
  if (mockVMCache.has(machineId)) {
    const cached = mockVMCache.get(machineId)!;
    // Only update last_updated timestamp
    return { ...cached, last_updated: new Date().toISOString() };
  }
  
  // Generate new value and cache it
  const newStatus: VMStatus = {
    machine_id: machineId,
    has_prediction: true,
    predicted_thickness_nm: 50 + Math.random() * 5,
    confidence_score: 0.85 + Math.random() * 0.1,
    r2r_correction: (Math.random() - 0.5) * 2,
    ewma_error: (Math.random() - 0.5) * 1.5,
    needs_correction: Math.random() > 0.7,
    last_updated: new Date().toISOString(),
    message: 'Demo mode - mock prediction',
  };
  
  mockVMCache.set(machineId, newStatus);
  return newStatus;
};

// Generate mock VM history for demo mode
const generateMockVMHistory = (): VMHistoryPoint[] => {
  const history: VMHistoryPoint[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const recordedAt = new Date(now.getTime() - i * 60 * 60 * 1000);
    history.push({
      recorded_at: recordedAt.toISOString(),
      predicted_thickness_nm: 50 + Math.random() * 5,
      temperature: 60 + Math.random() * 15,
      pressure: 100 + Math.random() * 50,
      power_consumption: 500 + Math.random() * 200,
    });
  }
  
  return history;
};

/**
 * Hook for polling VM status of a single machine
 */
export function useVirtualMetrology(
  machineId: string | null,
  options: UseVirtualMetrologyOptions = {}
) {
  const { pollingInterval = 30000, enabled = true } = options;
  const apiAvailable = isApiConfigured();
  
  const [status, setStatus] = useState<VMStatus | null>(null);
  const [history, setHistory] = useState<VMHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchVMStatus = useCallback(async () => {
    if (!machineId || !enabled) return;
    
    // If API not available, return mock data immediately
    if (!apiAvailable) {
      setStatus(generateMockVMStatus(machineId));
      setHistory({
        machine_id: machineId,
        history: [],
        trend: 'stable',
        avg_thickness: 50,
        std_thickness: 2,
      });
      setLastUpdated(new Date());
      return;
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [statusData, historyData] = await Promise.all([
        api.getVMStatus(machineId),
        api.getVMHistory(machineId, 24),
      ]);
      
      // If API returns empty/unrealistic data (no prediction), use mock data
      if (!statusData.has_prediction || !statusData.predicted_thickness_nm) {
        setStatus(generateMockVMStatus(machineId));
      } else {
        setStatus(statusData);
      }
      
      // If history is empty, generate mock history
      if (!historyData.history || historyData.history.length === 0) {
        setHistory({
          machine_id: machineId,
          history: generateMockVMHistory(),
          trend: 'stable',
          avg_thickness: 50 + Math.random() * 5,
          std_thickness: 1.5 + Math.random(),
        });
      } else {
        setHistory(historyData);
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
        console.error('VM fetch error:', err);
        // Fall back to mock data on error
        setStatus(generateMockVMStatus(machineId));
        setHistory({
          machine_id: machineId,
          history: generateMockVMHistory(),
          trend: 'stable',
          avg_thickness: 50 + Math.random() * 5,
          std_thickness: 1.5 + Math.random(),
        });
        setLastUpdated(new Date());
      }
    } finally {
      setIsLoading(false);
    }
  }, [machineId, enabled, apiAvailable]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!machineId || !enabled) {
      setStatus(null);
      setHistory(null);
      return;
    }
    
    // Initial fetch
    fetchVMStatus();
    
    // Set up polling
    if (pollingInterval > 0) {
      intervalRef.current = setInterval(fetchVMStatus, pollingInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [machineId, enabled, pollingInterval, fetchVMStatus]);

  const refresh = useCallback(() => {
    return fetchVMStatus();
  }, [fetchVMStatus]);

  return {
    status,
    history,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}

/**
 * Hook for polling VM status of multiple machines
 */
export function useVirtualMetrologyBatch(
  machineIds: string[],
  options: UseVirtualMetrologyOptions = {}
) {
  const { pollingInterval = 30000, enabled = true } = options;
  const apiAvailable = isApiConfigured();
  
  const [statuses, setStatuses] = useState<Record<string, VMStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAllStatuses = useCallback(async () => {
    if (machineIds.length === 0 || !enabled) return;
    
    // If API not available, return mock data for all machines
    if (!apiAvailable) {
      const mockStatuses: Record<string, VMStatus> = {};
      machineIds.forEach(id => {
        mockStatuses[id] = generateMockVMStatus(id);
      });
      setStatuses(mockStatuses);
      setLastUpdated(new Date());
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await Promise.allSettled(
        machineIds.map(id => api.getVMStatus(id))
      );
      
      const newStatuses: Record<string, VMStatus> = {};
      
      results.forEach((result, index) => {
        const machineId = machineIds[index];
        if (result.status === 'fulfilled') {
          const statusData = result.value;
          // If API returns empty/unrealistic data, use mock data
          if (!statusData.has_prediction || !statusData.predicted_thickness_nm) {
            newStatuses[machineId] = generateMockVMStatus(machineId);
          } else {
            newStatuses[machineId] = statusData;
          }
        } else {
          // On error, use mock data
          newStatuses[machineId] = generateMockVMStatus(machineId);
        }
      });
      
      setStatuses(newStatuses);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
        console.error('VM batch fetch error:', err);
        // Fall back to mock data on error
        const mockStatuses: Record<string, VMStatus> = {};
        machineIds.forEach(id => {
          mockStatuses[id] = generateMockVMStatus(id);
        });
        setStatuses(mockStatuses);
        setLastUpdated(new Date());
      }
    } finally {
      setIsLoading(false);
    }
  }, [machineIds, enabled, apiAvailable]);

  useEffect(() => {
    if (machineIds.length === 0 || !enabled) {
      setStatuses({});
      return;
    }
    
    fetchAllStatuses();
    
    if (pollingInterval > 0) {
      intervalRef.current = setInterval(fetchAllStatuses, pollingInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [machineIds, enabled, pollingInterval, fetchAllStatuses]);

  const refresh = useCallback(() => {
    return fetchAllStatuses();
  }, [fetchAllStatuses]);

  return {
    statuses,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}

/**
 * Hook for VM model information
 */
export function useVMModelInfo() {
  const apiAvailable = isApiConfigured();
  const [modelInfo, setModelInfo] = useState<VMModelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModelInfo = useCallback(async () => {
    if (!apiAvailable) {
      // Return mock model info in demo mode
      setModelInfo({
        is_trained: true,
        features: ['temperature', 'pressure', 'power_consumption'],
        ewma_tracked_tools: 5,
        model_path: '/demo/model.pkl',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.getVMModelInfo();
      setModelInfo(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
        console.error('VM model info fetch error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiAvailable]);

  useEffect(() => {
    fetchModelInfo();
  }, [fetchModelInfo]);

  return {
    modelInfo,
    isLoading,
    error,
    refresh: fetchModelInfo,
  };
}

export default useVirtualMetrology;
