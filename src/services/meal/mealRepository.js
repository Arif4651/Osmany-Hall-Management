import { apiRequest, toQueryString } from '../apiClient';

const apiRepository = {
  async getModule(wing) {
    return apiRequest(`/meals/module${toQueryString({ wing })}`);
  },
  async updateCutoffTime(cutoffTime, wing) {
    return apiRequest('/meals/settings/cutoff', {
      method: 'PUT',
      body: JSON.stringify({ cutoffTime, wing }),
    });
  },
  async upsertMealConfiguration({ dayId, mealTypeId, wing, commonItems, optionalItems }) {
    return apiRequest('/meals/configuration', {
      method: 'PUT',
      body: JSON.stringify({
        dayId,
        mealTypeId,
        wing,
        commonItems,
        optionalItems,
      }),
    });
  },
  async getStudentPreferences(date) {
    return apiRequest(`/meals/preferences/me${toQueryString({ date })}`);
  },
  async saveStudentPreferences(payload) {
    return apiRequest('/meals/preferences/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};

const mealRepository = apiRepository;

export default mealRepository;
