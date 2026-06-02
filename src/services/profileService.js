import { apiRequest } from './apiClient';

export const profileService = {
  getProfile: async () => {
    return apiRequest('/student/profile');
  },

  updateProfile: async (payload) => {
    return apiRequest('/student/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
