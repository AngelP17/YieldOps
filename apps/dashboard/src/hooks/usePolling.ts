import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePollingOptions {
  intervalMs: number;
  enabled?: boolean;
}

/**
 * Simple polling hook that periodically calls a fetch function.
 * Returns the latest data, loading state, and error.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  { intervalMs, enabled = true }: UsePollingOptions
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const doFetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchFnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, doFetch]);

  return { data, loading, error, refetch: doFetch };
}
