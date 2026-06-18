/**
 * useCachedFetch.js — React hook for data fetching with transparent caching.
 *
 * Features:
 *  - Returns cached data immediately (stale-while-revalidate)
 *  - Runs background refresh when cache is stale
 *  - Deduplicates in-flight requests for the same cache key
 *  - Allows manual refresh via returned `refresh()` function
 *  - Gracefully handles unmount during async operations
 *
 * @example
 *   const { data, isLoading, error, refresh } = useCachedFetch(
 *     'billing-2025-6',
 *     () => financialService.getMyBill(6, 2025),
 *     { ttl: 30_000 }
 *   );
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { queryCache } from '../services/queryCache';

/**
 * @template T
 * @param {string | null} cacheKey   - Unique key. Pass `null` to skip fetching.
 * @param {() => Promise<T>} fetcher - Async function that loads data.
 * @param {object} [options]
 * @param {number} [options.ttl=300000]       - Cache TTL in ms (default 5 min).
 * @param {boolean} [options.enabled=true]    - Set to false to skip the fetch.
 * @param {T | null} [options.initialData]    - Seed data shown before first fetch.
 * @returns {{ data: T|null, isLoading: boolean, isRefreshing: boolean, error: string, refresh: () => void }}
 */
export function useCachedFetch(cacheKey, fetcher, options = {}) {
  const { ttl = 5 * 60_000, enabled = true, initialData = undefined } = options;

  const [data, setData] = useState(() => {
    if (!cacheKey) return initialData;
    const cached = queryCache.get(cacheKey);
    return cached !== null ? cached : initialData;
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (!enabled || !cacheKey) return false;
    return queryCache.get(cacheKey) === null;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Keep stable references to avoid stale closures
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);

  const doFetch = useCallback(
    async (isBackground = false) => {
      if (!cacheKey || !enabled) return;

      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError('');

      try {
        const result = await queryCache.dedupe(cacheKey, () => fetcherRef.current());
        if (!mountedRef.current) return;
        queryCache.set(cacheKey, result, ttl);
        setData(result);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [cacheKey, enabled, ttl],
  );

  // On mount (or when cacheKey / enabled changes):
  //  - If we have cached data → show it immediately, then do a background refresh
  //  - If we have no cached data → full loading state
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !cacheKey) {
      setIsLoading(false);
      return;
    }

    const cached = queryCache.get(cacheKey);
    if (cached !== null) {
      setData(cached);
      setIsLoading(false);
      // Revalidate in the background so data stays fresh
      doFetch(true);
    } else {
      setData(initialData);
      doFetch(false);
    }

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  /**
   * Force-invalidates the cache entry and re-fetches.
   * Call this after mutations to get fresh data.
   */
  const refresh = useCallback(() => {
    if (cacheKey) queryCache.remove(cacheKey);
    doFetch(false);
  }, [cacheKey, doFetch]);

  const refreshInBackground = useCallback(() => {
    if (cacheKey) queryCache.remove(cacheKey);
    doFetch(true);
  }, [cacheKey, doFetch]);

  /**
   * Direct cache updater (like SWR mutate). Updates the cached value
   * and local state immediately.
   */
  const mutate = useCallback((newData, shouldRevalidate = false) => {
    if (cacheKey) {
      queryCache.set(cacheKey, newData, ttl);
    }
    setData(newData);
    if (shouldRevalidate) {
      doFetch(true);
    }
  }, [cacheKey, ttl, doFetch]);

  return { data, isLoading, isRefreshing, error, refresh, refreshInBackground, mutate };
}
