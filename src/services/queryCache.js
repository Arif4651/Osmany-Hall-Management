/**
 * queryCache.js — lightweight in-memory cache with TTL and key-prefix invalidation.
 *
 * Usage:
 *   queryCache.set('students-list', data, 5 * 60_000);  // cache for 5 min
 *   queryCache.get('students-list');                      // data or null if stale/missing
 *   queryCache.invalidate('students');                    // evict all keys starting with 'students'
 *   queryCache.clear();                                   // evict everything (on logout)
 */

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes

/** @type {Map<string, { data: unknown; expiresAt: number }>} */
const store = new Map();

/** Set of in-flight promise keys (for deduplication). */
const inflight = new Map();

export const queryCache = {
  /**
   * Returns cached data for `key` if it exists and has not expired.
   * Returns `null` otherwise.
   */
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data;
  },

  /**
   * Stores `data` under `key` with an expiry of `ttlMs` milliseconds from now.
   */
  set(key, data, ttlMs = DEFAULT_TTL_MS) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  /**
   * Returns true if the key exists and is not expired.
   */
  has(key) {
    return queryCache.get(key) !== null;
  },

  /**
   * Invalidates all cache entries whose key **starts with** `prefix`.
   * Call this after mutations to evict related data.
   *
   * @example
   *   queryCache.invalidate('billing-');  // evict all billing data
   *   queryCache.invalidate('students-'); // evict all student data
   */
  invalidate(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  },

  /**
   * Removes a single exact key from the cache.
   */
  remove(key) {
    store.delete(key);
  },

  /**
   * Clears the entire cache. Call on logout.
   */
  clear() {
    store.clear();
    inflight.clear();
  },

  /**
   * Deduplicates in-flight requests with the same key.
   * If a fetch for `key` is already in progress, returns the same promise.
   * This prevents parallel identical API calls when multiple components mount
   * simultaneously.
   *
   * @param {string} key
   * @param {() => Promise<unknown>} fetcher
   */
  async dedupe(key, fetcher) {
    if (inflight.has(key)) {
      return inflight.get(key);
    }
    const promise = fetcher().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  },

  /** How many entries are currently cached (for debugging). */
  get size() {
    return store.size;
  },
};
