import { apiRequest } from './apiClient';

function toDateKey(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 7);
}

function buildMonthlyRevenue(payments = []) {
  const buckets = new Map();

  payments.forEach((payment) => {
    const key = toDateKey(payment.submittedAt);
    const current = buckets.get(key) || {
      key,
      month: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${payment.submittedAt}T00:00:00`)),
      collected: 0,
      pending: 0,
    };

    if (payment.status === 'verified') {
      current.collected += Number(payment.amount) || 0;
    } else {
      current.pending += Number(payment.amount) || 0;
    }

    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(({ key, ...entry }) => entry);
}

export const portalService = {
  getAdminDashboard: async () => {
    const [dashboard, payments] = await Promise.all([
      apiRequest('/dashboard/admin'),
      apiRequest('/payments'),
    ]);

    return {
      stats: dashboard?.stats || [],
      payments: payments || [],
      monthlyRevenue: buildMonthlyRevenue(payments || []),
    };
  },

  getStudentPortalData: async (studentId) => {
    if (!studentId) {
      throw new Error('Student account information is not available.');
    }

    const [dashboard, bills, payments, notifications] = await Promise.all([
      apiRequest(`/dashboard/student/${studentId}`),
      apiRequest(`/billing/student/${studentId}`),
      apiRequest(`/payments/student/${studentId}`),
      apiRequest(`/notifications/student/${studentId}`),
    ]);

    return {
      stats: dashboard?.stats || [],
      bills: bills || [],
      payments: payments || [],
      notifications: notifications || [],
    };
  },
};