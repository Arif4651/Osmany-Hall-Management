import { Menu, Search, LogOut, Shield, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { BRANDING } from '../../constants/branding';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';

function generateHeading(pathname) {
  const section = pathname.split('/').filter(Boolean).slice(-1)[0] || 'landing';
  return section
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export default function TopHeader({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate(ROUTE_PATHS.login, { replace: true });
  };

  return (
    <header className="top-header">
      <button type="button" className="menu-button" onClick={onOpenSidebar} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <div className="header-title-wrap">
        <p className="header-subtitle">{`${BRANDING.universityShortName} · ${BRANDING.hallName}`}</p>
        <h2>{generateHeading(location.pathname)}</h2>
      </div>

      <div className="header-actions">
        <label className="search-input" htmlFor="global-search">
          <Search size={16} />
          <input id="global-search" type="text" placeholder="Search students, bills, reports" />
        </label>

        {user ? (
          <div className="user-chip" title={user.email}>
            {user.role === 'admin' ? <Shield size={14} /> : <UserRound size={14} />}
            <span>{user.fullName}</span>
          </div>
        ) : null}

        <Button variant="ghost" onClick={handleLogout}>
          <LogOut size={15} /> Logout
        </Button>
      </div>
    </header>
  );
}