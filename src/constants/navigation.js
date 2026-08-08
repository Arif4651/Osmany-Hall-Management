import { CalendarDays, ClipboardList, CreditCard, Package, Receipt, Settings, ShieldCheck, Soup, Users, WalletCards, Megaphone, Terminal } from 'lucide-react';
import { ROUTE_PATHS } from './routePaths';

import { MENU_KEYS } from '../services/permissionService';

// `menuKey` ties a nav entry to its row in the permission matrix. Entries without one are always
// visible (they carry no privileged data); everything else is filtered by the signed-in grants.
export const STUDENT_NAV_ITEMS = [
  { key: 'meal-preferences', label: 'Meal Preferences', path: ROUTE_PATHS.studentMeals, icon: Soup, menuKey: MENU_KEYS.studentMeals },
  { key: 'meal-snapshot', label: 'Meal Snapshot', path: ROUTE_PATHS.studentMealSnapshot, icon: CalendarDays, menuKey: MENU_KEYS.studentMealSnapshot },
  { key: 'view-menu', label: 'View Menu', path: ROUTE_PATHS.studentViewMenu, icon: ClipboardList, menuKey: MENU_KEYS.studentViewMenu },
  { key: 'billing', label: 'Billing', path: ROUTE_PATHS.studentBilling, icon: Receipt, menuKey: MENU_KEYS.studentBilling },
  { key: 'payments', label: 'Payments', path: ROUTE_PATHS.studentPayments, icon: CreditCard, menuKey: MENU_KEYS.studentPayments },
  { key: 'daily-cost', label: 'Daily Cost', path: ROUTE_PATHS.studentDailyCost, icon: CalendarDays, menuKey: MENU_KEYS.studentDailyCost },
  { key: 'notice-board', label: 'Notice Board', path: ROUTE_PATHS.studentNoticeBoard, icon: Megaphone, menuKey: MENU_KEYS.studentNoticeBoard },
  { key: 'dev-profile', label: 'Developer Profile', path: ROUTE_PATHS.studentDeveloperProfile, icon: Terminal, className: 'dev-profile-nav' },
];

export const ADMIN_NAV_ITEMS = [
  { key: 'students', label: 'Student Management', path: ROUTE_PATHS.adminStudents, icon: Users, menuKey: MENU_KEYS.adminStudents },
  { key: 'meals', label: 'Meal Management', path: ROUTE_PATHS.adminMeals, icon: Soup, menuKey: MENU_KEYS.adminMeals },
  { key: 'meal-sheet', label: 'Meal Sheet', path: ROUTE_PATHS.adminMealSheet, icon: ClipboardList, menuKey: MENU_KEYS.adminMealSheet },
  { key: 'inventory', label: 'Inventory', path: ROUTE_PATHS.adminInventory, icon: Package, menuKey: MENU_KEYS.adminInventory },
  { key: 'billing', label: 'Bill Management', path: ROUTE_PATHS.adminBilling, icon: ClipboardList, menuKey: MENU_KEYS.adminBilling },
  { key: 'due', label: 'Due Bill', path: ROUTE_PATHS.adminDue, icon: WalletCards, menuKey: MENU_KEYS.adminDue },
  { key: 'payments', label: 'Payment Verification', path: ROUTE_PATHS.adminPayments, icon: ShieldCheck, menuKey: MENU_KEYS.adminPayments },
  { key: 'daily-cost', label: 'Daily Cost', path: ROUTE_PATHS.adminDailyCost, icon: CalendarDays, menuKey: MENU_KEYS.adminDailyCost },
  { key: 'notice-board', label: 'Notice Board', path: ROUTE_PATHS.adminNoticeBoard, icon: Megaphone, menuKey: MENU_KEYS.adminNoticeBoard },
  { key: 'settings', label: 'Settings', path: ROUTE_PATHS.adminSettings, icon: Settings, menuKey: MENU_KEYS.adminSettings },
];
