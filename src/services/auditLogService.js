import { apiRequest, toQueryString } from './apiClient';

export const auditLogService = {
  /**
   * Fetch paginated, filtered audit logs.
   * @param {Object} params - Filter/pagination parameters
   * @param {string} [params.module]
   * @param {string} [params.action]
   * @param {string} [params.role]
   * @param {string} [params.entityType]
   * @param {string} [params.search]
   * @param {string} [params.fromDate] - ISO date string
   * @param {string} [params.toDate] - ISO date string
   * @param {boolean} [params.isSuccess]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   */
  getLogs: (params = {}) =>
    apiRequest(`/audit-logs${toQueryString(params)}`),

  /** Fetch a single log detail (includes OldValues/NewValues). */
  getLog: (id) => apiRequest(`/audit-logs/${id}`),

  /** Fetch summary card statistics. */
  getStats: () => apiRequest('/audit-logs/stats'),

  /**
   * Build a CSV export URL with the given filters.
   * Returns a URL string; the caller navigates to it (triggers browser download).
   */
  buildExportUrl: (params = {}) => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5012/api';
    return `${base}/audit-logs/export${toQueryString(params)}`;
  },
};

/** Well-known module labels that match the backend AuditModules constants. */
export const AUDIT_MODULES = [
  { value: 'All', label: 'All Modules' },
  { value: 'Student Management', label: 'Student Management' },
  { value: 'Meal Management', label: 'Meal Management' },
  { value: 'Meal Sheet', label: 'Meal Sheet' },
  { value: 'Attendance', label: 'Attendance' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Bill Management', label: 'Bill Management' },
  { value: 'Due Bill', label: 'Due Bill' },
  { value: 'Payment Verification', label: 'Payment Verification' },
  { value: 'Daily Cost', label: 'Daily Cost' },
  { value: 'Notice Board', label: 'Notice Board' },
  { value: 'User & Role Management', label: 'User & Role Management' },
  { value: 'Authentication', label: 'Authentication' },
  { value: 'System', label: 'System' },
];

/** Well-known action types. */
export const AUDIT_ACTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'ACTIVATE', label: 'Activate' },
  { value: 'DEACTIVATE', label: 'Deactivate' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'LOGIN_FAILED', label: 'Login Failed' },
  { value: 'PASSWORD_CHANGE', label: 'Password Change' },
  { value: 'ROLE_CHANGE', label: 'Role Change' },
  { value: 'PERMISSION_CHANGE', label: 'Permission Change' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
  { value: 'CONFIGURATION_CHANGE', label: 'Configuration Change' },
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'STOCK_OUT', label: 'Stock Out' },
  { value: 'DUE_ADJUSTMENT', label: 'Due Adjustment' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OTHER', label: 'Other' },
];

/** Color/badge mapping for action types. */
export function getActionBadgeClass(action) {
  switch (action) {
    case 'CREATE': return 'log-action-create';
    case 'UPDATE': case 'CONFIGURATION_CHANGE': case 'STATUS_CHANGE': return 'log-action-update';
    case 'DELETE': return 'log-action-delete';
    case 'APPROVE': case 'VERIFY': case 'PAYMENT': return 'log-action-approve';
    case 'REJECT': return 'log-action-reject';
    case 'LOGIN': return 'log-action-login';
    case 'LOGOUT': return 'log-action-logout';
    case 'LOGIN_FAILED': return 'log-action-failed';
    case 'PASSWORD_CHANGE': case 'ROLE_CHANGE': case 'PERMISSION_CHANGE': return 'log-action-security';
    case 'STOCK_IN': case 'STOCK_OUT': return 'log-action-inventory';
    default: return 'log-action-other';
  }
}

/**
 * Admin role options for the Role filter in System Logs.
 * Student is intentionally omitted — student actions are not logged.
 */
export const AUDIT_ROLES = [
  { value: '', label: 'All Roles' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'male_wing_admin', label: 'Male Wing Admin' },
  { value: 'female_wing_admin', label: 'Female Wing Admin' },
];

