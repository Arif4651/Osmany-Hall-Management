import { Menu, PanelLeftClose, PanelLeftOpen, Search, LogOut, Shield, UserRound, Venus, Mars } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import { BRANDING } from '../../constants/branding';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';
import { adminDataService } from '../../services/adminDataService';

function generateHeading(pathname) {
  const section = pathname.split('/').filter(Boolean).slice(-1)[0] || 'landing';
  return section
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

const ADMIN_ROLES = ['admin', 'super_admin', 'male_wing_admin', 'female_wing_admin'];

export default function TopHeader({ onOpenSidebar, onToggleSidebarCollapsed, isSidebarCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // All admin roles (including wing admins) can search students — backend scopes results by wing automatically
    if (!ADMIN_ROLES.includes(user?.role)) return undefined;
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { setResults(await adminDataService.searchStudents(query)); }
      finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, user?.role]);

  const handleLogout = () => {
    logout();
    navigate(ROUTE_PATHS.login, { replace: true });
  };

  // Pick the right icon for the user chip based on role
  function getRoleIcon() {
    if (user?.role === 'male_wing_admin') return <Mars size={14} />;
    if (user?.role === 'female_wing_admin') return <Venus size={14} />;
    if (user?.role === 'admin' || user?.role === 'super_admin') return <Shield size={14} />;
    return <UserRound size={14} />;
  }

  return (
    <header className="top-header">
      <button type="button" className="menu-button" onClick={onOpenSidebar} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <button
        type="button"
        className="sidebar-toggle-button"
        onClick={onToggleSidebarCollapsed}
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <div className="header-title-wrap">
        <p className="header-subtitle">{`${BRANDING.universityShortName} · ${BRANDING.hallName}`}</p>
        <h2>{generateHeading(location.pathname)}</h2>
      </div>

      <div className="header-actions">
        {ADMIN_ROLES.includes(user?.role) && <div className="global-search-wrap">
          <label className="search-input" htmlFor="global-search">
            <Search size={16} />
            <input id="global-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" autoComplete="off" />
          </label>
          {query.trim() && <div className="global-search-results">
            {searching ? <div>Searching...</div> : results.length ? results.map((student) => <button key={student.id} onClick={() => { navigate(`${ROUTE_PATHS.adminStudents}?student=${student.id}`); setQuery(''); }}><strong>{student.name}</strong><span>Roll: {student.rollNumber} · Hall ID: {student.hallId}</span></button>) : <div>No student found.</div>}
          </div>}
        </div>}

        {user ? (
          <div className="user-chip" title={user.email}>
            {getRoleIcon()}
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
