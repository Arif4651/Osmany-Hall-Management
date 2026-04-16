import { Navigate, useLocation } from 'react-router-dom';
import { ROUTE_PATHS } from '../constants/routePaths';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, role }) {
  const location = useLocation();
  const { isAuthenticated, role: loggedRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location }} />;
  }

  if (role && loggedRole !== role) {
    const fallback = loggedRole === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard;
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return children;
  }

  return <Navigate to={role === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard} replace />;
}