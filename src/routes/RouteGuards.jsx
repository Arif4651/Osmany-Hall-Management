import { Navigate, useLocation } from 'react-router-dom';
import { DEFAULT_REDIRECTS, ROUTE_PATHS } from '../constants/routePaths';
import { ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../constants/navigation';
import { useAuth } from '../context/AuthContext';
import PageSkeleton from '../components/ui/PageSkeleton';

const ADMIN_ROLES = ['admin', 'super_admin', 'male_wing_admin', 'female_wing_admin'];

/**
 * Where to send someone who has no access to the page they asked for: their first permitted nav
 * entry. Falls back to the static default only when the matrix grants them nothing.
 */
function firstPermittedPath(navItems, can, fallback) {
  const permitted = navItems.find(
    (item) => item.key !== 'dev-profile' && item.menuKey && can(item.menuKey, 'view'),
  );
  return permitted?.path ?? fallback;
}

export function ProtectedRoute({ children, role, menuKey }) {
  const location = useLocation();
  const {
    isSessionLoading, isAuthenticated, role: loggedRole, mustChangePassword,
    isPermissionsLoading, isSuperAdmin, can,
  } = useAuth();

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

  const isAllowedRole = !role || loggedRole === role || (role === 'admin' && ADMIN_ROLES.includes(loggedRole));
  if (!isAllowedRole) {
    const fallback = ADMIN_ROLES.includes(loggedRole) ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.student;
    return <Navigate to={fallback} replace />;
  }

  if (menuKey) {
    // Grants arrive after the session does; rendering the page before they land would flash
    // content the role may not be allowed to see.
    if (isPermissionsLoading) return <PageSkeleton />;

    if (!isSuperAdmin && !can(menuKey, 'view')) {
      const isAdminArea = ADMIN_ROLES.includes(loggedRole);
      const target = isAdminArea
        ? firstPermittedPath(ADMIN_NAV_ITEMS, can, DEFAULT_REDIRECTS.admin)
        : firstPermittedPath(STUDENT_NAV_ITEMS, can, DEFAULT_REDIRECTS.student);

      // Guard against redirecting a page to itself when nothing at all is granted.
      if (target === location.pathname) return <NoAccessNotice />;
      return <Navigate to={target} replace />;
    }
  }

  return children;
}

function NoAccessNotice() {
  return (
    <div className="student-message student-message-error" style={{ margin: '2rem' }}>
      Your role currently has no pages assigned. Ask a super admin to grant access under
      Settings → Role Permissions.
    </div>
  );
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

  return <Navigate to={ADMIN_ROLES.includes(role) ? DEFAULT_REDIRECTS.admin : DEFAULT_REDIRECTS.student} replace />;
}
