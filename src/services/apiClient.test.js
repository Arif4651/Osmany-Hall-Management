// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiClient helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('recognizes an expired session by expiresAtUtc', async () => {
    const { isSessionExpired } = await import('./apiClient');
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(isSessionExpired(future)).toBe(false);
    expect(isSessionExpired(past)).toBe(true);
    expect(isSessionExpired(null)).toBe(true);
    expect(isSessionExpired(undefined)).toBe(true);
  });

  it('aborts a request when the configured timeout is reached', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_TIMEOUT_MS', '1000');
    vi.resetModules();

    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    })));

    const { apiRequest } = await import('./apiClient');
    const request = apiRequest('/health-check-for-test');
    const expectation = expect(request).rejects.toMatchObject({
      message: 'The server did not respond within 1 seconds. Please try again.',
      status: 408,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;
  });

  it('sends credentials: include on every request', async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', mockFetch);

    const { apiRequest } = await import('./apiClient');
    await apiRequest('/auth/logout', { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
