// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

function createToken(payload) {
  const encode = (value) => window.btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('apiClient authentication helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('recognizes unexpired and expired access tokens', async () => {
    const { isTokenExpired } = await import('./apiClient');
    const nowInSeconds = Math.floor(Date.now() / 1000);

    expect(isTokenExpired(createToken({ exp: nowInSeconds + 60 }))).toBe(false);
    expect(isTokenExpired(createToken({ exp: nowInSeconds - 60 }))).toBe(true);
    expect(isTokenExpired('not-a-token')).toBe(true);
  });

  it('aborts a request when the configured timeout is reached', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_TIMEOUT_MS', '1000');
    vi.resetModules();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

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
});
