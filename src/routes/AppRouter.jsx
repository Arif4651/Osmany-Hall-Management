import { Route, Routes, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import NotFoundPage from '../pages/system/NotFoundPage';
import StudentDashboard from '../pages/student/StudentDashboard';
import MealManagement from '../pages/student/MealManagement';
import Billing from '../pages/student/Billing';
import Payments from '../pages/student/Payments';
import Profile from '../pages/student/Profile';
import Notifications from '../pages/student/Notifications';
import AdminDashboard from '../pages/admin/AdminDashboard';
import StudentManagement from '../pages/admin/StudentManagement';
import AdminMealManagement from '../pages/admin/AdminMealManagement';
import BillingManagement from '../pages/admin/BillingManagement';
import PaymentVerification from '../pages/admin/PaymentVerification';
import Inventory from '../pages/admin/Inventory';
import Reports from '../pages/admin/Reports';
import AuditLogs from '../pages/admin/AuditLogs';
import Analytics from '../pages/admin/Analytics';
import Settings from '../pages/admin/Settings';
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
        path="/student"
        element={
          <ProtectedRoute role="student">
            <AppLayout role="student" navItems={STUDENT_NAV_ITEMS} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={DEFAULT_REDIRECTS.student} replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="meals" element={<MealManagement />} />
        <Route path="billing" element={<Billing />} />
        <Route path="payments" element={<Payments />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
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
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="students" element={<StudentManagement />} />
        <Route path="meals" element={<AdminMealManagement />} />
        <Route path="billing" element={<BillingManagement />} />
        <Route path="payments" element={<PaymentVerification />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
    </Routes>
  );
}
