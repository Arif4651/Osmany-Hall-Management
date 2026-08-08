import { apiRequest } from './apiClient';

export const permissionService = {
  // Every authenticated user may read their own grants — this drives nav and button gating.
  getMyPermissions: async () => apiRequest('/permissions/me'),

  // Super-admin only below.
  getRoles: async () => apiRequest('/permissions/roles'),
  createRole: async (payload) => apiRequest('/permissions/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  deleteRole: async (role) => apiRequest(`/permissions/roles/${encodeURIComponent(role)}`, {
    method: 'DELETE',
  }),
  getRoleMatrix: async (role) => apiRequest(`/permissions/roles/${encodeURIComponent(role)}`),
  saveRoleMatrix: async (role, permissions) => apiRequest(`/permissions/roles/${encodeURIComponent(role)}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  }),
};

/** Menu keys the client references directly. Must match Domain/Constants/MenuKeys.cs. */
export const MENU_KEYS = {
  adminStudents: 'admin.students',
  adminMeals: 'admin.meals',
  adminMealSheet: 'admin.meal-sheet',
  adminAdditionalItems: 'admin.additional-items',
  adminInventory: 'admin.inventory',
  adminBilling: 'admin.billing',
  adminDue: 'admin.due',
  adminPayments: 'admin.payments',
  adminDailyCost: 'admin.daily-cost',
  adminOthersBill: 'admin.others-bill',
  adminNoticeBoard: 'admin.notice-board',
  adminSettings: 'admin.settings',
  adminRolePermissions: 'admin.role-permissions',

  studentMeals: 'student.meals',
  studentMealSnapshot: 'student.meal-snapshot',
  studentViewMenu: 'student.view-menu',
  studentAdditionalPreferences: 'student.additional-preferences',
  studentBilling: 'student.billing',
  studentPayments: 'student.payments',
  studentDailyCost: 'student.daily-cost',
  studentNoticeBoard: 'student.notice-board',
};
