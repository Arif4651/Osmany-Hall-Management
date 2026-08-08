import { apiRequest, toQueryString } from './apiClient';

export const adminDataService = {
  getInventory: async (includeDeleted = false, wing) => apiRequest(`/inventory/items${toQueryString({ includeDeleted, wing })}`),
  getParticipantCount: async ({ date, mealPeriod, itemId, wing }) => apiRequest(`/inventory/participant-count${toQueryString({ date, mealPeriod, itemId, wing })}`),
  createInventoryItem: async (payload) => apiRequest('/inventory/items', { method: 'POST', body: JSON.stringify(payload) }),
  updateInventoryItem: async (id, payload) => apiRequest(`/inventory/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteInventoryItem: async (id) => apiRequest(`/inventory/items/${id}`, { method: 'DELETE' }),
  forceDeleteInventoryItem: async (id) => apiRequest(`/inventory/items/${id}/force`, { method: 'DELETE' }),
  // Open stock-in batches for an item, oldest first. Labels are positional and renumber as
  // batches are used up, so always send `id` back on a stock-out, never the label.
  getInventoryBatches: async ({ itemId, wing, includeEmpty = false }) => apiRequest(`/inventory/items/${itemId}/batches${toQueryString({ wing, includeEmpty })}`),
  // Open batches for every stored item in the wing, in one request.
  getAllInventoryBatches: async (wing) => apiRequest(`/inventory/batches${toQueryString({ wing })}`),
  getInventoryLedger: async ({ itemId, from, to, wing }) => apiRequest(`/inventory/transactions${toQueryString({ itemId, from, to, wing })}`),
  createInventoryMovement: async (payload) => apiRequest('/inventory/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  updateInventoryMovement: async (id, payload) => apiRequest(`/inventory/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteInventoryMovement: async (id) => apiRequest(`/inventory/transactions/${id}`, { method: 'DELETE' }),
  getAuditLogs: async () => apiRequest('/audit-logs'),
  getBillingRecords: async ({ month, year, gender = 'All', status = 'All' }) => apiRequest(`/billing/monthly${toQueryString({ month, year, gender, status })}`),
  createDswSubsidy: async (payload) => apiRequest('/billing/subsidies', { method: 'POST', body: JSON.stringify(payload) }),
  getDswSubsidies: async ({ month, year, wing }) => apiRequest(`/billing/subsidies${toQueryString({ month, year, wing })}`),
  updateDswSubsidy: async (id, payload) => apiRequest(`/billing/subsidies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDswSubsidy: async (id) => apiRequest(`/billing/subsidies/${id}`, { method: 'DELETE' }),

  // ── Additional meal items (Tea, Milk, …) ──────────────────────────────────
  getAdditionalItems: async () => apiRequest('/meals/additional/items'),
  createAdditionalItem: async (payload) => apiRequest('/meals/additional/items', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdditionalItem: async (id, payload) => apiRequest(`/meals/additional/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAdditionalItem: async (id) => apiRequest(`/meals/additional/items/${id}`, { method: 'DELETE' }),
  // Roster of who took what on a given date — meant to sit beside getMealSheet.
  getAdditionalSheet: async ({ date, wing }) => apiRequest(`/meals/additional/sheet${toQueryString({ date, wing })}`),

  // ── Others Bill ───────────────────────────────────────────────────────────
  getOthersBills: async ({ month, year, wing }) => apiRequest(`/billing/others-bills${toQueryString({ month, year, wing })}`),
  previewOthersBill: async (payload) => apiRequest('/billing/others-bills/preview', { method: 'POST', body: JSON.stringify(payload) }),
  generateOthersBill: async (payload) => apiRequest('/billing/others-bills', { method: 'POST', body: JSON.stringify(payload) }),
  deleteOthersBill: async (id) => apiRequest(`/billing/others-bills/${id}`, { method: 'DELETE' }),
  getServiceBill: async ({ month, year, wing }) => apiRequest(`/billing/service-bills${toQueryString({ month, year, wing })}`),
  deleteServiceBill: async ({ month, year, wing }) => apiRequest(`/billing/service-bills${toQueryString({ month, year, wing })}`, { method: 'DELETE' }),
  recalculateBillingMonth: async ({ month, year }) => apiRequest(`/billing/subsidies/recalculate${toQueryString({ month, year })}`, { method: 'POST' }),
  saveServiceBill: async (payload) => apiRequest('/billing/service-bills', { method: 'PUT', body: JSON.stringify(payload) }),
  getPayments: async ({ gender, status, search, page, pageSize }) => apiRequest(`/payments/admin${toQueryString({ gender, status, search, page, pageSize })}`),
  reviewPayment: async (id, action, approvedAmount = null) => apiRequest(`/payments/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, approvedAmount }),
  }),
  getDueRows: async (month, year, gender) => apiRequest(`/due${toQueryString({ month, year, gender })}`),
  saveDueAdjustment: async (payload) => apiRequest('/due/adjustments', { method: 'POST', body: JSON.stringify(payload) }),
  getDailyCost: async (month, year, gender) => apiRequest(`/daily-cost${toQueryString({ month, year, gender })}`),
  searchStudents: async (q, wing) => apiRequest(`/admin/students/search${toQueryString({ q, wing })}`),
  getMealModule: async (wing) => apiRequest(`/meals/module${toQueryString({ wing })}`),
  getMealCounts: async (date, wing) => apiRequest(`/meals/counts${toQueryString({ date, wing })}`),
  // Global meal overrides
  getGlobalOverrides: async (from, to, wing) => apiRequest(`/meals/overrides${toQueryString({ from, to, wing })}`),
  createGlobalOverride: async (payload) => apiRequest('/meals/overrides', { method: 'POST', body: JSON.stringify(payload) }),
  deleteGlobalOverride: async (id) => apiRequest(`/meals/overrides/${id}`, { method: 'DELETE' }),
  getStudentMealControl: async (studentRecordId, date, wing) => apiRequest(`/meals/student-controls/${studentRecordId}${toQueryString({ date, wing })}`),
  saveStudentMealControlStatus: async (payload) => apiRequest('/meals/student-controls/status', { method: 'PUT', body: JSON.stringify(payload) }),
  getMealSheet: async (date, wing) => apiRequest(`/meals/sheet${toQueryString({ date, wing })}`),
  getAdminAccounts: async () => apiRequest('/admin-settings/admins'),
  createAdminAccount: async (payload) => apiRequest('/admin-settings/admins', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminAccount: async (id, payload) => apiRequest(`/admin-settings/admins/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
};
