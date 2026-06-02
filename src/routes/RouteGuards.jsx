import { Navigate, useLocation } from 'react-router-dom';
import { ROUTE_PATHS } from '../constants/routePaths';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, role }) {
  const location = useLocation();
  const { isSessionLoading, isAuthenticated, role: loggedRole, mustChangePassword } = useAuth();

  if (isSessionLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location }} />;
  }

  if (mustChangePassword && location.pathname !== ROUTE_PATHS.changePassword) {
    return <Navigate to={ROUTE_PATHS.changePassword} replace />;
  }

  if (role && loggedRole !== role) {
    const fallback = loggedRole === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard;
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { isSessionLoading, isAuthenticated, role, mustChangePassword } = useAuth();

  if (isSessionLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return children;
  }

  if (mustChangePassword) {
    return <Navigate to={ROUTE_PATHS.changePassword} replace />;
  }

  return <Navigate to={role === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard} replace />;
}
