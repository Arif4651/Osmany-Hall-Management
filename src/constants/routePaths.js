export const ROUTE_PATHS = {
  landing: '/',
  login: '/login',
  adminLogin: '/halladmin',
  changePassword: '/change-password',

  studentDashboard: '/student/dashboard',
  studentMeals: '/student/meals',
  studentBilling: '/student/billing',
  studentPayments: '/student/payments',
  studentProfile: '/student/profile',
  studentNotifications: '/student/notifications',

  adminDashboard: '/admin/dashboard',
  adminStudents: '/admin/students',
  adminMeals: '/admin/meals',
  adminBilling: '/admin/billing',
  adminPayments: '/admin/payments',
  adminInventory: '/admin/inventory',
  adminReports: '/admin/reports',
  adminAuditLogs: '/admin/audit-logs',
  adminAnalytics: '/admin/analytics',
  adminSettings: '/admin/settings',

  notFound: '*',
};

export const DEFAULT_REDIRECTS = {
  student: ROUTE_PATHS.studentDashboard,
  admin: ROUTE_PATHS.adminDashboard,
};
