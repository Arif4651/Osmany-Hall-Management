import { createContext, useCallback, useContext, useEffect } from 'react';
import { queryCache } from '../services/queryCache';
import { useAuth } from './AuthContext';

const QueryCacheContext = createContext(null);

/**
 * QueryCacheProvider — wraps the app and clears the in-memory query cache
 * whenever the user logs out. This prevents stale data from one user's session
 * being served to the next user who logs in on the same browser tab.
 */
export function QueryCacheProvider({ children }) {
  const { isAuthenticated } = useAuth();

  // When the user logs out (isAuthenticated flips to false), clear all cached data.
  useEffect(() => {
    if (!isAuthenticated) {
      queryCache.clear();
    }
  }, [isAuthenticated]);

  const invalidate = useCallback((prefix) => queryCache.invalidate(prefix), []);
  const clear = useCallback(() => queryCache.clear(), []);

  return (
    <QueryCacheContext.Provider value={{ invalidate, clear }}>
      {children}
    </QueryCacheContext.Provider>
  );
}

/**
 * useQueryCache — exposes cache invalidation helpers to components.
 *
 * @example
 *   const { invalidate } = useQueryCache();
 *   // After creating a student:
 *   invalidate('students-');
 */
export function useQueryCache() {
  const ctx = useContext(QueryCacheContext);
  if (!ctx) throw new Error('useQueryCache must be used within QueryCacheProvider');
  return ctx;
}
