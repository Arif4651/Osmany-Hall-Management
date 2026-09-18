import { apiRequest, toQueryString } from './apiClient';

export const attendanceService = {
  getCurrent: async () => apiRequest('/attendance/me/current'),
  mark: async ({ latitude, longitude, accuracyMeters }) => apiRequest('/attendance/me/mark', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude, accuracyMeters }),
  }),
  getHistory: async () => apiRequest('/attendance/me/history'),
  getMonth: async ({ year, month }) => apiRequest(`/attendance/me/month${toQueryString({ year, month })}`),

  getSessions: async (hallId) => apiRequest(`/attendance/sessions${toQueryString({ hallId })}`),
  createSession: async (payload) => apiRequest('/attendance/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateSession: async (id, payload) => apiRequest(`/attendance/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  setSessionActive: async (id, isActive) => apiRequest(`/attendance/sessions/${id}/active${toQueryString({ isActive })}`, {
    method: 'PATCH',
  }),
  getSheet: async (params) => apiRequest(`/attendance/sheet${toQueryString(params)}`),

  getHallOptions: async () => apiRequest('/attendance/hall-options'),
  getHallLocations: async () => apiRequest('/attendance/hall-locations'),
  createHallLocation: async (payload) => apiRequest('/attendance/hall-locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateHallLocation: async (id, payload) => apiRequest(`/attendance/hall-locations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  setHallLocationActive: async (id, isActive) => apiRequest(`/attendance/hall-locations/${id}/active${toQueryString({ isActive })}`, {
    method: 'PATCH',
  }),
};
