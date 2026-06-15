import { apiRequest } from './apiClient';

export const noticeService = {
  getNotices: () => apiRequest('/notices'),
  createNotice: (data) => apiRequest('/notices', { method: 'POST', body: JSON.stringify(data) }),
  updateNotice: (id, data) => apiRequest(`/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNotice: (id) => apiRequest(`/notices/${id}`, { method: 'DELETE' }),
};
