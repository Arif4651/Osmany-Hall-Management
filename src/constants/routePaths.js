export const ROUTE_PATHS = {
  landing: '/',
  login: '/login',
  adminLogin: '/halladmin',
  changePassword: '/change-password',

  studentMeals: '/student/meals',
  studentMealSnapshot: '/student/meal-snapshot',
  studentViewMenu: '/student/view-menu',
  studentBilling: '/student/billing',
  studentPayments: '/student/payments',
  studentProfile: '/student/profile',
  studentNotifications: '/student/notifications',

  adminStudents: '/admin/students',
  adminMeals: '/admin/meals',
  adminMealSheet: '/admin/meal-sheet',
  adminBilling: '/admin/billing',
  adminPayments: '/admin/payments',
  adminInventory: '/admin/inventory',
  adminDue: '/admin/due',
  adminDailyCost: '/admin/daily-cost',
  adminSettings: '/admin/settings',
  notFound: '*',
};

export const DEFAULT_REDIRECTS = {
  student: ROUTE_PATHS.studentMeals,
  admin: ROUTE_PATHS.adminStudents,
};
