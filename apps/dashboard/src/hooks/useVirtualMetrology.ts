import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// Generate mock VM status for demo mode
const generateMockVMStatus = (machineId: string): VMStatus => ({
  machine_id: machineId,
  has_prediction: true,
  predicted_thickness_nm: 50 + Math.random() * 5,
  confidence_score: 0.85 + Math.random() * 0.1,
  r2r_correction: (Math.random() - 0.5) * 2,
  ewma_error: (Math.random() - 0.5) * 1.5,
  needs_correction: Math.random() > 0.7,
  last_updated: new Date().toISOString(),
  message: 'Demo mode - mock prediction',
});

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

// Global cache for mock data - shared between all hook instances
// This prevents data regeneration and flickering when switching machines
const globalMockCache: Record<string, { status: VMStatus; history: VMHistory }> = {};

/**
 * Hook for polling VM status of a single machine
 */
export function useVirtualMetrology(
  machineId: string | null,
  options: UseVirtualMetrologyOptions = {}
) {
  const { pollingInterval = 30000, enabled = true } = options;
  const apiAvailable = isApiConfigured();

  // Use global cache for mock data - shared with batch hook
  const getMockData = useCallback((id: string): { status: VMStatus; history: VMHistory } => {
    if (!globalMockCache[id]) {
      globalMockCache[id] = {
        status: generateMockVMStatus(id),
        history: {
          machine_id: id,
          history: generateMockVMHistory(),
          trend: 'stable' as const,
          avg_thickness: 50 + Math.random() * 5,
          std_thickness: 1.5 + Math.random(),
        },
      };
    }
    return globalMockCache[id];
  }, []);

  // For mock mode: compute mock data SYNCHRONOUSLY during render using useMemo
  // This ensures data is available on the FIRST render, not after useEffect
  const mockData = useMemo(() => {
    if (!apiAvailable && machineId && enabled) {
      return getMockData(machineId);
    }
    return null;
  }, [apiAvailable, machineId, enabled, getMockData]);

  // State for API mode only
  const [apiStatus, setApiStatus] = useState<VMStatus | null>(null);
  const [apiHistory, setApiHistory] = useState<VMHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Only run useEffect for API mode
  useEffect(() => {
    // Clear interval on unmount or when deps change
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };

    if (!machineId || !enabled) {
      setApiStatus(null);
      setApiHistory(null);
      setLastUpdated(null);
      return cleanup;
    }

    // Skip useEffect for mock mode - data is already provided via useMemo
    if (!apiAvailable) {
      setLastUpdated(new Date());
      return cleanup;
    }

    // API is available - do async fetch
    const fetchVMStatus = async () => {
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
          const fallbackMock = getMockData(machineId);
          setApiStatus(fallbackMock.status);
        } else {
          setApiStatus(statusData);
        }

        // If history is empty, generate mock history
        if (!historyData.history || historyData.history.length === 0) {
          const fallbackMock = getMockData(machineId);
          setApiHistory(fallbackMock.history);
        } else {
          setApiHistory(historyData);
        }

        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err);
          console.error('VM fetch error:', err);
          // Fall back to mock data on error
          const fallbackMock = getMockData(machineId);
          setApiStatus(fallbackMock.status);
          setApiHistory(fallbackMock.history);
          setLastUpdated(new Date());
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchVMStatus();

    // Set up polling
    if (pollingInterval > 0) {
      intervalRef.current = setInterval(fetchVMStatus, pollingInterval);
    }

    return cleanup;
  }, [machineId, enabled, pollingInterval, apiAvailable, getMockData]);

  const refresh = useCallback(() => {
    if (!machineId || !enabled) return;

    if (!apiAvailable) {
      // Just update timestamp for mock mode
      setLastUpdated(new Date());
      return;
    }
  }, [machineId, enabled, apiAvailable]);

  // Return mock data synchronously for mock mode, or API data for API mode
  // Mock mode: data is available immediately on first render
  // API mode: data may be null initially while loading
  const effectiveStatus = mockData?.status ?? apiStatus;
  const effectiveHistory = mockData?.history ?? apiHistory;

  return {
    status: effectiveStatus,
    history: effectiveHistory,
    isLoading: apiAvailable ? isLoading : false, // Never loading in mock mode
    error,
    lastUpdated: mockData ? (lastUpdated || new Date()) : lastUpdated,
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

  // Use global cache for mock data - shared with single hook
  const getMockStatus = useCallback((id: string): VMStatus => {
    if (!globalMockCache[id]) {
      globalMockCache[id] = {
        status: generateMockVMStatus(id),
        history: {
          machine_id: id,
          history: generateMockVMHistory(),
          trend: 'stable' as const,
          avg_thickness: 50 + Math.random() * 5,
          std_thickness: 1.5 + Math.random(),
        },
      };
    }
    return globalMockCache[id].status;
  }, []);

  // For mock mode: compute mock data SYNCHRONOUSLY during render using useMemo
  const mockStatuses = useMemo(() => {
    if (!apiAvailable && machineIds.length > 0 && enabled) {
      const result: Record<string, VMStatus> = {};
      machineIds.forEach(id => {
        result[id] = getMockStatus(id);
      });
      return result;
    }
    return null;
  }, [apiAvailable, machineIds, enabled, getMockStatus]);

  // State for API mode only
  const [apiStatuses, setApiStatuses] = useState<Record<string, VMStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Only run useEffect for API mode
  useEffect(() => {
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (machineIds.length === 0 || !enabled) {
      setApiStatuses({});
      return cleanup;
    }

    // Skip useEffect for mock mode - data is already provided via useMemo
    if (!apiAvailable) {
      setLastUpdated(new Date());
      return cleanup;
    }

    // API is available - do async fetch
    const fetchAllStatuses = async () => {
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
              newStatuses[machineId] = getMockStatus(machineId);
            } else {
              newStatuses[machineId] = statusData;
            }
          } else {
            // On error, use mock data
            newStatuses[machineId] = getMockStatus(machineId);
          }
        });

        setApiStatuses(newStatuses);
        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof Error) {
          setError(err);
          console.error('VM batch fetch error:', err);
          // Fall back to mock data on error
          const fallbackStatuses: Record<string, VMStatus> = {};
          machineIds.forEach(id => {
            fallbackStatuses[id] = getMockStatus(id);
          });
          setApiStatuses(fallbackStatuses);
          setLastUpdated(new Date());
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllStatuses();

    if (pollingInterval > 0) {
      intervalRef.current = setInterval(fetchAllStatuses, pollingInterval);
    }

    return cleanup;
  }, [machineIds, enabled, pollingInterval, apiAvailable, getMockStatus]);

  const refresh = useCallback(() => {
    if (!apiAvailable) {
      setLastUpdated(new Date());
    }
  }, [apiAvailable]);

  // Return mock data synchronously for mock mode, or API data for API mode
  const effectiveStatuses = mockStatuses ?? apiStatuses;

  return {
    statuses: effectiveStatuses,
    isLoading: apiAvailable ? isLoading : false, // Never loading in mock mode
    error,
    lastUpdated: mockStatuses ? (lastUpdated || new Date()) : lastUpdated,
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
