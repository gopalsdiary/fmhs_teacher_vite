import { useState, useEffect, useCallback } from 'react';
import { cacheGet, cacheSet } from '../cache';

interface UseOfflineSyncOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  staleTime?: number;
}

export function useOfflineSync<T>({
  key,
  fetcher,
  enabled = true,
  onSuccess,
  staleTime
}: UseOfflineSyncOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    // 1. Try to get from cache first
    const cached = await cacheGet<T>(key);
    if (cached) {
      setData(cached);
      if (onSuccess) onSuccess(cached);
      if (!force) setLoading(false); // If we have cache and it's not a force refresh, we can stop loading
    }

    // 2. If online, fetch fresh data
    if (navigator.onLine) {
      try {
        const freshData = await fetcher();
        await cacheSet(key, freshData, staleTime);
        setData(freshData);
        if (onSuccess) onSuccess(freshData);
        setError(null);
      } catch (err) {
        console.error(`Sync error for ${key}:`, err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        // We already set data from cache, so just keep that
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
      if (!cached) {
        setError(new Error('Offline and no cached data available.'));
      }
    }
  }, [key, fetcher, enabled, onSuccess, staleTime]);

  useEffect(() => {
    fetchData();

    const handleOnline = () => {
      setIsOffline(false);
      fetchData(true);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  return { data, loading, error, isOffline, refetch: () => fetchData(true) };
}
