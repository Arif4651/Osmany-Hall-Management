import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { useAppShell } from '../../context/AppShellContext';
import { BRANDING } from '../../constants/branding';

export default function AppLayout({ role, navItems }) {
  const { sidebarOpen, sidebarCollapsed, closeSidebar, openSidebar, toggleSidebarCollapsed } = useAppShell();

  return (
    <div className={`app-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Sidebar role={role} navItems={navItems} isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="app-main-wrap">
        <TopHeader
          onOpenSidebar={openSidebar}
          onToggleSidebarCollapsed={toggleSidebarCollapsed}
          isSidebarCollapsed={sidebarCollapsed}
        />
        <main className="app-main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <p>{`${BRANDING.hallName} · ${BRANDING.universityShortName}`}</p>
          <small>{BRANDING.motto}</small>
        </footer>
      </div>
    </div>
  );
}