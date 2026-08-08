import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageSkeleton from '../components/ui/PageSkeleton';
import { ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../constants/navigation';
import { DEFAULT_REDIRECTS, ROUTE_PATHS } from '../constants/routePaths';
import { MENU_KEYS } from '../services/permissionService';
import { ProtectedRoute, PublicOnlyRoute } from './RouteGuards';

/** Wraps a page in the permission guard for its menu. */
const guard = (menuKey, element) => <ProtectedRoute menuKey={menuKey}>{element}</ProtectedRoute>;

// ── Eagerly-loaded (tiny, always needed) ─────────────────────────────────────
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import NotFoundPage from '../pages/system/NotFoundPage';

// ── Lazy-loaded student pages ─────────────────────────────────────────────────
const MealManagement    = lazy(() => import('../pages/student/MealManagement'));
const MealSnapshot      = lazy(() => import('../pages/student/MealSnapshot'));
const ViewMenu          = lazy(() => import('../pages/student/ViewMenu'));
const Billing           = lazy(() => import('../pages/student/Billing'));
const Payments          = lazy(() => import('../pages/student/Payments'));
const StudentNoticeBoard = lazy(() => import('../pages/student/StudentNoticeBoard'));

// ── Lazy-loaded admin pages ───────────────────────────────────────────────────
const StudentManagement  = lazy(() => import('../pages/admin/StudentManagement'));
const AdminMealManagement = lazy(() => import('../pages/admin/AdminMealManagement'));
const MealSheet          = lazy(() => import('../pages/admin/MealSheet'));
const BillingManagement  = lazy(() => import('../pages/admin/BillingManagement'));
const PaymentVerification = lazy(() => import('../pages/admin/PaymentVerification'));
const Inventory          = lazy(() => import('../pages/admin/Inventory'));
const DueBill            = lazy(() => import('../pages/admin/DueBill'));
const DailyCost          = lazy(() => import('../pages/admin/DailyCost'));
const AdminSettings      = lazy(() => import('../pages/admin/AdminSettings'));
const AdminNoticeBoard   = lazy(() => import('../pages/admin/AdminNoticeBoard'));

// ── Lazy-loaded shared pages ──────────────────────────────────────────────────
const DeveloperProfile = lazy(() => import('../pages/common/DeveloperProfile'));

const PageFallback = <PageSkeleton />;

export default function AppRouter() {
  return (
    <Suspense fallback={PageFallback}>
      <Routes>
        <Route path={ROUTE_PATHS.landing} element={<LandingPage />} />
        <Route
          path={ROUTE_PATHS.login}
          element={
            <PublicOnlyRoute>
              <LoginPage mode="student" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.adminLogin}
          element={
            <PublicOnlyRoute>
              <LoginPage mode="admin" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.changePassword}
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <AppLayout role="student" navItems={STUDENT_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={DEFAULT_REDIRECTS.student} replace />} />
          <Route path="meals"           element={guard(MENU_KEYS.studentMeals, <MealManagement />)} />
          <Route path="meal-snapshot"   element={guard(MENU_KEYS.studentMealSnapshot, <MealSnapshot />)} />
          <Route path="view-menu"       element={guard(MENU_KEYS.studentViewMenu, <ViewMenu />)} />
          <Route path="billing"         element={guard(MENU_KEYS.studentBilling, <Billing />)} />
          <Route path="payments"        element={guard(MENU_KEYS.studentPayments, <Payments />)} />
          <Route path="daily-cost"      element={guard(MENU_KEYS.studentDailyCost, <DailyCost />)} />
          <Route path="notice-board"    element={guard(MENU_KEYS.studentNoticeBoard, <StudentNoticeBoard />)} />
          <Route path="developer-profile" element={<DeveloperProfile />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AppLayout role="admin" navItems={ADMIN_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={DEFAULT_REDIRECTS.admin} replace />} />
          <Route path="students"    element={guard(MENU_KEYS.adminStudents, <StudentManagement />)} />
          <Route path="meals"       element={guard(MENU_KEYS.adminMeals, <AdminMealManagement />)} />
          <Route path="meal-sheet"  element={guard(MENU_KEYS.adminMealSheet, <MealSheet />)} />
          <Route path="billing"     element={guard(MENU_KEYS.adminBilling, <BillingManagement />)} />
          <Route path="payments"    element={guard(MENU_KEYS.adminPayments, <PaymentVerification />)} />
          <Route path="inventory"   element={guard(MENU_KEYS.adminInventory, <Inventory />)} />
          <Route path="due"         element={guard(MENU_KEYS.adminDue, <DueBill />)} />
          <Route path="daily-cost"  element={guard(MENU_KEYS.adminDailyCost, <DailyCost />)} />
          <Route path="notice-board" element={guard(MENU_KEYS.adminNoticeBoard, <AdminNoticeBoard />)} />
          <Route path="settings"    element={guard(MENU_KEYS.adminSettings, <AdminSettings />)} />
          <Route path="developer-profile" element={<DeveloperProfile />} />
        </Route>

        <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

