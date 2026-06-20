import { apiRequest } from './apiClient';
import { queryCache } from './queryCache';

const NOTICES_CACHE_KEY = 'notices-current-user';
const NOTICES_CACHE_TTL_MS = 5 * 60_000;

async function getNotices() {
  const cached = queryCache.get(NOTICES_CACHE_KEY);
  if (cached !== null) return cached;

  return queryCache.dedupe(NOTICES_CACHE_KEY, async () => {
    const notices = await apiRequest('/notices');
    queryCache.set(NOTICES_CACHE_KEY, notices, NOTICES_CACHE_TTL_MS);
    return notices;
  });
}

async function mutateNotices(request) {
  const result = await request();
  queryCache.invalidate('notices');
  return result;
}

export const noticeService = {
  getNotices,
  createNotice: (data) => mutateNotices(() => apiRequest('/notices', {
    method: 'POST',
    body: JSON.stringify(data),
  })),
  updateNotice: (id, data) => mutateNotices(() => apiRequest(`/notices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })),
  deleteNotice: (id) => mutateNotices(() => apiRequest(`/notices/${id}`, { method: 'DELETE' })),
};
