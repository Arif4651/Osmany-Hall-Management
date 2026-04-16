import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { useAppShell } from '../../context/AppShellContext';
import { BRANDING } from '../../constants/branding';

export default function AppLayout({ role, navItems }) {
  const { sidebarOpen, closeSidebar, openSidebar } = useAppShell();

  return (
    <div className="app-shell">
      <Sidebar role={role} navItems={navItems} isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="app-main-wrap">
        <TopHeader onOpenSidebar={openSidebar} />
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