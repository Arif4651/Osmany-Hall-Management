import { apiRequest } from '../apiClient';

const apiRepository = {
  async getModule() {
    return apiRequest('/meals/module');
  },
  async updateCutoffTime(cutoffTime) {
    return apiRequest('/meals/settings/cutoff', {
      method: 'PUT',
      body: JSON.stringify({ cutoffTime }),
    });
  },
  async upsertMealConfiguration({ dayId, mealTypeId, commonItems, optionalItems }) {
    return apiRequest('/meals/configuration', {
      method: 'PUT',
      body: JSON.stringify({
        dayId,
        mealTypeId,
        commonItems,
        optionalItems,
      }),
    });
  },
  async getStudentPreferences(studentId) {
    return apiRequest(`/meals/preferences/${studentId}`);
  },
  async saveStudentPreferences(studentId, preferences) {
    return apiRequest(`/meals/preferences/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  },
};

const mealRepository = apiRepository;

export default mealRepository;
