import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { X, LogOut, Key, ScrollText } from 'lucide-react';
import Button from '../ui/Button';
import mistLogo from '../../assets/images/mist-logo.png';
import { BRANDING } from '../../constants/branding';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';
import ChangePasswordModal from './ChangePasswordModal';

export default function Sidebar({ role, navItems, isOpen, onClose, hasNewNotices, setHasNewNotices }) {
  const { user, logout, can, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const userRole = (user?.role || '').toLowerCase();
  const userDesignation = (user?.designation || '').toLowerCase();
  const userEmail = (user?.email || '').toLowerCase();
  const isSuper = Boolean(
    isSuperAdmin ||
    userRole === 'super_admin' ||
    userRole === 'superadmin' ||
    userDesignation.includes('super') ||
    userEmail.startsWith('superadmin')
  );
  const devProfileItem = navItems.find((item) => item.key === 'dev-profile');
  // Nav is now a projection of the permission matrix: an entry appears only where the role has
  // view access to its menu. Entries with no menuKey are unrestricted.
  const filteredNavItems = navItems.filter(
    (item) => item.key !== 'dev-profile' &&
      (!item.menuKey || can(item.menuKey, 'view')) &&
      (!item.superAdminOnly || isSuper)
  );
  // Super Admin Logs item placed below divider
  const logsItem = navItems.find((item) => item.key === 'logs') || {
    key: 'logs',
    label: 'Logs',
    path: ROUTE_PATHS.adminLogs,
    icon: ScrollText,
  };
  const showLogs = role === 'admin' && isSuper;
  const DevIcon = devProfileItem?.icon;

  const handleLogout = () => {
    logout();
    navigate(ROUTE_PATHS.login, { replace: true });
  };

  return (
    <>
      <aside className={clsx('app-sidebar', { 'is-open': isOpen })}>
        <div className="sidebar-head">
          <Link className="brand" to="/">
            <img className="brand-logo" src={mistLogo} alt={`${BRANDING.universityShortName} logo`} />
            <span className="brand-text">
              {BRANDING.hallName}
              <small>{`${BRANDING.universityShortName} · ${role === 'admin' ? `${user?.wing ? `${user.wing} Wing ` : ''}Admin Console` : 'Student Portal'}`}</small>
            </span>
          </Link>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label={`${role} navigation`}>
          {filteredNavItems
            .filter((item) => !item.superAdminOnly)
            .map((item) => {
              const Icon = item.icon;
              const isNoticeBoard = item.key === 'notice-board';
              const showBadge = isNoticeBoard && role === 'student' && hasNewNotices;

              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) => clsx('nav-item', { 'is-active': isActive }, item.className)}
                  onClick={() => {
                    if (isNoticeBoard) {
                      setHasNewNotices(false);
                      localStorage.setItem('lastNoticeBoardVisit', new Date().toISOString());
                    }
                    onClose();
                  }}
                  title={item.label}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {showBadge && <span className="nav-badge-dot" />}
                </NavLink>
              );
            })}

          {/* Super Admin-only items separated by a divider */}
          {showLogs && (
            <>
              <div className="sidebar-nav-divider" />
              <NavLink
                to={ROUTE_PATHS.adminLogs || '/admin/logs'}
                className={({ isActive }) => clsx('nav-item', { 'is-active': isActive })}
                onClick={onClose}
                title="Logs"
              >
                <ScrollText size={18} />
                <span>Logs</span>
              </NavLink>
            </>
          )}
        </nav>

        {devProfileItem && (
          <div className="sidebar-dev-profile">
            <NavLink
              to={devProfileItem.path}
              className={({ isActive }) => clsx('nav-item dev-profile-nav', { 'is-active': isActive })}
              onClick={onClose}
              title={devProfileItem.label}
            >
              {DevIcon && <DevIcon size={14} />}
              <span>{devProfileItem.label}</span>
            </NavLink>
          </div>
        )}

        <div className="sidebar-account">
          {role === 'student' ? (
            <button
              type="button"
              className="sidebar-profile-btn"
              onClick={() => setIsChangePasswordOpen(true)}
              title="Change Password"
            >
              <div className="profile-info">
                <p>{user?.fullName || 'Authenticated User'}</p>
                <small>{user?.designation || 'Osmany Hall Member'}</small>
              </div>
              <Key size={14} className="change-password-icon" />
            </button>
          ) : (
            <div className="sidebar-profile-static">
              <p>{user?.fullName || 'Authenticated User'}</p>
              <small>{user?.designation || 'Osmany Hall Member'}</small>
            </div>
          )}
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut size={14} />
            <span className="sidebar-signout-label">Sign Out</span>
          </Button>
        </div>
      </aside>
      {isOpen ? (
        <button type="button" aria-label="Close sidebar" className="sidebar-overlay" onClick={onClose} />
      ) : null}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
}
