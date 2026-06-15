import { CalendarDays, ClipboardList, CreditCard, Package, Receipt, Settings, ShieldCheck, Soup, Users, WalletCards } from 'lucide-react';
import { ROUTE_PATHS } from './routePaths';

export const STUDENT_NAV_ITEMS = [
  { key: 'meal-preferences', label: 'Meal Preferences', path: ROUTE_PATHS.studentMeals, icon: Soup },
  { key: 'meal-snapshot', label: 'Meal Snapshot', path: ROUTE_PATHS.studentMealSnapshot, icon: CalendarDays },
  { key: 'view-menu', label: 'View Menu', path: ROUTE_PATHS.studentViewMenu, icon: ClipboardList },
  { key: 'billing', label: 'Billing', path: ROUTE_PATHS.studentBilling, icon: Receipt },
  { key: 'payments', label: 'Payments', path: ROUTE_PATHS.studentPayments, icon: CreditCard },
  { key: 'daily-cost', label: 'Daily Cost', path: ROUTE_PATHS.studentDailyCost, icon: CalendarDays },
];

export const ADMIN_NAV_ITEMS = [
  { key: 'students', label: 'Student Management', path: ROUTE_PATHS.adminStudents, icon: Users },
  { key: 'meals', label: 'Meal Management', path: ROUTE_PATHS.adminMeals, icon: Soup },
  { key: 'meal-sheet', label: 'Meal Sheet', path: ROUTE_PATHS.adminMealSheet, icon: ClipboardList },
  { key: 'inventory', label: 'Inventory', path: ROUTE_PATHS.adminInventory, icon: Package },
  { key: 'billing', label: 'Bill Management', path: ROUTE_PATHS.adminBilling, icon: ClipboardList },
  { key: 'due', label: 'Due Bill', path: ROUTE_PATHS.adminDue, icon: WalletCards },
  { key: 'payments', label: 'Payment Verification', path: ROUTE_PATHS.adminPayments, icon: ShieldCheck },
  { key: 'daily-cost', label: 'Daily Cost', path: ROUTE_PATHS.adminDailyCost, icon: CalendarDays },
  { key: 'settings', label: 'Settings', path: ROUTE_PATHS.adminSettings, icon: Settings, superAdminOnly: true },
];
