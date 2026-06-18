import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageSkeleton from '../components/ui/PageSkeleton';
import { ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../constants/navigation';
import { DEFAULT_REDIRECTS, ROUTE_PATHS } from '../constants/routePaths';
import { ProtectedRoute, PublicOnlyRoute } from './RouteGuards';

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
          <Route path="meals"           element={<MealManagement />} />
          <Route path="meal-snapshot"   element={<MealSnapshot />} />
          <Route path="view-menu"       element={<ViewMenu />} />
          <Route path="billing"         element={<Billing />} />
          <Route path="payments"        element={<Payments />} />
          <Route path="daily-cost"      element={<DailyCost />} />
          <Route path="notice-board"    element={<StudentNoticeBoard />} />
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
          <Route path="students"    element={<StudentManagement />} />
          <Route path="meals"       element={<AdminMealManagement />} />
          <Route path="meal-sheet"  element={<MealSheet />} />
          <Route path="billing"     element={<BillingManagement />} />
          <Route path="payments"    element={<PaymentVerification />} />
          <Route path="inventory"   element={<Inventory />} />
          <Route path="due"         element={<DueBill />} />
          <Route path="daily-cost"  element={<DailyCost />} />
          <Route path="notice-board" element={<AdminNoticeBoard />} />
          <Route
            path="settings"
            element={<ProtectedRoute role="super_admin"><AdminSettings /></ProtectedRoute>}
          />
          <Route path="developer-profile" element={<DeveloperProfile />} />
        </Route>

        <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

