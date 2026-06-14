import { Route, Routes, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import NotFoundPage from '../pages/system/NotFoundPage';
import MealManagement from '../pages/student/MealManagement';
import MealSnapshot from '../pages/student/MealSnapshot';
import ViewMenu from '../pages/student/ViewMenu';
import Billing from '../pages/student/Billing';
import Payments from '../pages/student/Payments';
import StudentManagement from '../pages/admin/StudentManagement';
import AdminMealManagement from '../pages/admin/AdminMealManagement';
import MealSheet from '../pages/admin/MealSheet';
import BillingManagement from '../pages/admin/BillingManagement';
import PaymentVerification from '../pages/admin/PaymentVerification';
import Inventory from '../pages/admin/Inventory';
import DueBill from '../pages/admin/DueBill';
import DailyCost from '../pages/admin/DailyCost';
import AdminSettings from '../pages/admin/AdminSettings';
import { ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../constants/navigation';
import { DEFAULT_REDIRECTS, ROUTE_PATHS } from '../constants/routePaths';
import { ProtectedRoute, PublicOnlyRoute } from './RouteGuards';

export default function AppRouter() {
  return (
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
        <Route path="meals" element={<MealManagement />} />
        <Route path="meal-snapshot" element={<MealSnapshot />} />
        <Route path="view-menu" element={<ViewMenu />} />
        <Route path="billing" element={<Billing />} />
        <Route path="payments" element={<Payments />} />
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
        <Route path="students" element={<StudentManagement />} />
        <Route path="meals" element={<AdminMealManagement />} />
        <Route path="meal-sheet" element={<MealSheet />} />
        <Route path="billing" element={<BillingManagement />} />
        <Route path="payments" element={<PaymentVerification />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="due" element={<DueBill />} />
        <Route path="daily-cost" element={<DailyCost />} />
        <Route path="settings" element={<ProtectedRoute role="super_admin"><AdminSettings /></ProtectedRoute>} />
      </Route>

      <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
    </Routes>
  );
}
