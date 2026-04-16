import {
  Bell,
  ChartBar,
  ClipboardList,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Soup,
  User,
  Users,
} from 'lucide-react';
import { ROUTE_PATHS } from './routePaths';

export const STUDENT_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: ROUTE_PATHS.studentDashboard, icon: LayoutDashboard },
  { key: 'meals', label: 'Meal Management', path: ROUTE_PATHS.studentMeals, icon: Soup },
  { key: 'billing', label: 'Billing', path: ROUTE_PATHS.studentBilling, icon: Receipt },
  { key: 'payments', label: 'Payments', path: ROUTE_PATHS.studentPayments, icon: CreditCard },
  { key: 'profile', label: 'Profile', path: ROUTE_PATHS.studentProfile, icon: User },
  {
    key: 'notifications',
    label: 'Notifications',
    path: ROUTE_PATHS.studentNotifications,
    icon: Bell,
  },
];

export const ADMIN_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: ROUTE_PATHS.adminDashboard, icon: Gauge },
  { key: 'students', label: 'Student Management', path: ROUTE_PATHS.adminStudents, icon: Users },
  { key: 'meals', label: 'Meal Management', path: ROUTE_PATHS.adminMeals, icon: Soup },
  { key: 'billing', label: 'Billing Management', path: ROUTE_PATHS.adminBilling, icon: ClipboardList },
  {
    key: 'payments',
    label: 'Payment Verification',
    path: ROUTE_PATHS.adminPayments,
    icon: ShieldCheck,
  },
  { key: 'inventory', label: 'Inventory', path: ROUTE_PATHS.adminInventory, icon: Package },
  { key: 'reports', label: 'Reports', path: ROUTE_PATHS.adminReports, icon: ScrollText },
  { key: 'audit', label: 'Audit Logs', path: ROUTE_PATHS.adminAuditLogs, icon: ChartBar },
  { key: 'analytics', label: 'Analytics', path: ROUTE_PATHS.adminAnalytics, icon: ChartBar },
  { key: 'settings', label: 'Settings', path: ROUTE_PATHS.adminSettings, icon: Settings },
];