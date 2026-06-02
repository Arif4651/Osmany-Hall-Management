const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5012/api';
const TOKEN_STORAGE_KEY = 'osmany-hall-access-token-v1';

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

function normalizeValidationErrors(errors = {}) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key.charAt(0).toLowerCase() + key.slice(1), Array.isArray(value) ? value[0] : value]),
  );
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.title || 'Request failed.');
    error.status = response.status;
    error.validationErrors = normalizeValidationErrors(payload?.errors);
    throw error;
  }

  return payload;
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
