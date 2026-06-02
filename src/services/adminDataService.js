import { apiRequest } from './apiClient';

export const adminDataService = {
  getInventory: async () => apiRequest('/inventory'),
  getAuditLogs: async () => apiRequest('/audit-logs'),
  getBillingRecords: async () => apiRequest('/billing'),
  getPayments: async () => apiRequest('/payments'),
  getMealModule: async () => apiRequest('/meals/module'),
};
