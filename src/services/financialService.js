import { apiRequest, toQueryString } from './apiClient';

export const financialService = {
  getMyBill: (month, year) => apiRequest(`/billing/me${toQueryString({ month, year })}`),
  getMyBillSubsidies: (month, year) => apiRequest(`/billing/me/subsidies${toQueryString({ month, year })}`),
  getCategories: () => apiRequest('/payments/categories'),
  getMyPayments: () => apiRequest('/payments/me'),
  submitPayment: (payload) => apiRequest('/payments', { method: 'POST', body: JSON.stringify(payload) }),
  getOptions: () => apiRequest('/meals/options'),
  getPreferences: (date) => apiRequest(`/meals/preferences/me${toQueryString({ date })}`),
  savePreferences: (payload) => apiRequest('/meals/preferences/me', { method: 'PUT', body: JSON.stringify(payload) }),
  getSnapshot: (from, to) => apiRequest(`/meals/snapshot/me${toQueryString({ from, to })}`),
  getMenu: () => apiRequest('/meals/menu'),
  getWeeklyMenu: () => apiRequest('/meals/module'),
  saveMenu: (payload) => apiRequest('/meals/menu', { method: 'PUT', body: JSON.stringify(payload) }),
  // Guest meal requests
  getGuestMeals: (month, year) => apiRequest(`/meals/guest-meals/me${toQueryString({ month, year })}`),
  saveGuestMeal: (payload) => apiRequest('/meals/guest-meals/me', { method: 'POST', body: JSON.stringify(payload) }),
  deleteGuestMeal: (id) => apiRequest(`/meals/guest-meals/me/${id}`, { method: 'DELETE' }),
};
