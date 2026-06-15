import { Link, NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { X, LogOut } from 'lucide-react';
import Button from '../ui/Button';
import mistLogo from '../../assets/images/mist-logo.png';
import { BRANDING } from '../../constants/branding';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';

export default function Sidebar({ role, navItems, isOpen, onClose, hasNewNotices, setHasNewNotices }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          {navItems.filter((item) => !item.superAdminOnly || user?.role === 'super_admin').map((item) => {
            const Icon = item.icon;
            const isNoticeBoard = item.key === 'notice-board';
            const showBadge = isNoticeBoard && role === 'student' && hasNewNotices;

            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) => clsx('nav-item', { 'is-active': isActive })}
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
        </nav>

        <div className="sidebar-account">
          <p>{user?.fullName || 'Authenticated User'}</p>
          <small>{user?.designation || 'Osmany Hall Member'}</small>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut size={14} />
            <span className="sidebar-signout-label">Sign Out</span>
          </Button>
        </div>
      </aside>
      {isOpen ? (
        <button type="button" aria-label="Close sidebar" className="sidebar-overlay" onClick={onClose} />
      ) : null}
    </>
  );
}
