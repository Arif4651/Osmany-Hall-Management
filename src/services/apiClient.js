const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5012/api';
const configuredTimeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const REQUEST_TIMEOUT_MS = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
  ? configuredTimeoutMs
  : 30_000;
const TOKEN_STORAGE_KEY = 'osmany-hall-access-token-v1';
export const AUTH_UNAUTHORIZED_EVENT = 'osmany-hall-auth-unauthorized';

export function getAccessToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function notifyUnauthorized(message) {
  setAccessToken('');
  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
    detail: { message },
  }));
}

export function isTokenExpired(token) {
  try {
    const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = encodedPayload.padEnd(
      encodedPayload.length + ((4 - encodedPayload.length % 4) % 4),
      '=',
    );
    const payload = JSON.parse(window.atob(paddedPayload));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    handleCallerAbort();
  } else {
    options.signal?.addEventListener('abort', handleCallerAbort, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (didTimeout) {
      const timeoutSeconds = Math.round(REQUEST_TIMEOUT_MS / 1000);
      const timeoutError = new Error(`The server did not respond within ${timeoutSeconds} seconds. Please try again.`);
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', handleCallerAbort);
  }
}

function normalizeValidationErrors(errors = {}) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => {
      const normalizedKey = key === 'RollNumber'
        ? 'studentId'
        : key.charAt(0).toLowerCase() + key.slice(1);
      return [normalizedKey, Array.isArray(value) ? value[0] : value];
    }),
  );
}

function isJsonLikeContentType(contentType) {
  return contentType.includes('application/json') || contentType.includes('+json');
}

function firstValidationMessage(errors = {}) {
  const firstValue = Object.values(errors)[0];
  if (Array.isArray(firstValue)) return firstValue[0];
  return firstValue || '';
}

function humanizeErrorMessage(message) {
  const text = String(message || '').trim();

  if (!text) return 'Request failed.';
  if (text.includes('already being used for login')) {
    return 'This Student ID is already in use. Please enter a different Student ID.';
  }
  if (text.includes('student ID already exists') || text.includes('student ID is already exists')) {
    return 'This Student ID already exists. Please enter a different Student ID.';
  }

  return text;
}

const inFlightRequests = new Map();

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const requestKey = `${method}:${path}`;

  if (isGet && inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }

  const fetchPromise = (async () => {
    const headers = new Headers(options.headers || {});
    let token = getAccessToken();
    const isLoginRequest = path === '/auth/login';

    if (token && isTokenExpired(token)) {
      notifyUnauthorized('Your session has expired. Please sign in again.');
      token = null;
      if (!isLoginRequest) {
        const error = new Error('Your session has expired. Please sign in again.');
        error.status = 401;
        throw error;
      }
    }

    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = isJsonLikeContentType(contentType) ? await response.json() : null;

    if (!response.ok) {
      const normalizedErrors = normalizeValidationErrors(payload?.errors);
      const rawMessage = response.status === 401 && !isLoginRequest
        ? 'Your session has expired. Please sign in again.'
        : firstValidationMessage(payload?.errors) || payload?.message || payload?.title || 'Request failed.';
      const message = humanizeErrorMessage(rawMessage);
      if (response.status === 401 && !isLoginRequest) {
        notifyUnauthorized(message);
      }
      const error = new Error(message);
      error.status = response.status;
      error.validationErrors = Object.fromEntries(
        Object.entries(normalizedErrors).map(([key, value]) => [key, humanizeErrorMessage(value)]),
      );
      throw error;
    }

    return payload;
  })();

  if (isGet) {
    inFlightRequests.set(requestKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inFlightRequests.delete(requestKey);
    }
  }

  return fetchPromise;
}

export function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
