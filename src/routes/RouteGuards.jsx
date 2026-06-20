import { Navigate, useLocation } from 'react-router-dom';
import { DEFAULT_REDIRECTS, ROUTE_PATHS } from '../constants/routePaths';
import { useAuth } from '../context/AuthContext';
import PageSkeleton from '../components/ui/PageSkeleton';

export function ProtectedRoute({ children, role }) {
  const location = useLocation();
  const { isSessionLoading, isAuthenticated, role: loggedRole, mustChangePassword } = useAuth();

  if (isSessionLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    const loginPath = role === 'admin' ? ROUTE_PATHS.adminLogin : ROUTE_PATHS.login;
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (mustChangePassword && location.pathname !== ROUTE_PATHS.changePassword) {
    return <Navigate to={ROUTE_PATHS.changePassword} replace />;
  }

  const adminRoles = ['admin', 'super_admin', 'male_wing_admin', 'female_wing_admin'];
  const isAllowedRole = !role || loggedRole === role || (role === 'admin' && adminRoles.includes(loggedRole));
  if (!isAllowedRole) {
    const fallback = adminRoles.includes(loggedRole) ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.student;
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { isSessionLoading, isAuthenticated, role, mustChangePassword } = useAuth();

  if (isSessionLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return children;
  }

  if (mustChangePassword) {
    return <Navigate to={ROUTE_PATHS.changePassword} replace />;
  }

  return <Navigate to={['admin', 'super_admin', 'male_wing_admin', 'female_wing_admin'].includes(role) ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.student} replace />;
}
