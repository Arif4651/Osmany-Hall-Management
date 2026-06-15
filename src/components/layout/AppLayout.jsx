import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { useAppShell } from '../../context/AppShellContext';
import { BRANDING } from '../../constants/branding';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';
import { noticeService } from '../../services/noticeService';

export default function AppLayout({ role, navItems }) {
  const { sidebarOpen, sidebarCollapsed, closeSidebar, openSidebar, toggleSidebarCollapsed } = useAppShell();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasNewNotices, setHasNewNotices] = useState(false);

  const checkNewNotices = async () => {
    if (!user || role !== 'student') return;
    try {
      const notices = await noticeService.getNotices();
      if (notices && notices.length > 0) {
        const lastVisit = localStorage.getItem('lastNoticeBoardVisit');
        if (!lastVisit) {
          setHasNewNotices(true);
        } else {
          const lastVisitDate = new Date(lastVisit);
          const hasNew = notices.some(n => new Date(n.createdAtUtc) > lastVisitDate);
          setHasNewNotices(hasNew);
        }
      }
    } catch (err) {
      console.error('Failed to check for new notices:', err);
    }
  };

  useEffect(() => {
    checkNewNotices();
    // Poll every 60 seconds
    const interval = setInterval(checkNewNotices, 60000);
    return () => clearInterval(interval);
  }, [user, role]);

  // Automatically mark notices read if they navigate to notice board page
  useEffect(() => {
    if (location.pathname === ROUTE_PATHS.studentNoticeBoard) {
      setHasNewNotices(false);
      localStorage.setItem('lastNoticeBoardVisit', new Date().toISOString());
    }
  }, [location.pathname]);

  return (
    <div className={`app-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Sidebar 
        role={role} 
        navItems={navItems} 
        isOpen={sidebarOpen} 
        onClose={closeSidebar} 
        hasNewNotices={hasNewNotices}
        setHasNewNotices={setHasNewNotices}
      />
      <div className="app-main-wrap">
        <TopHeader
          onOpenSidebar={openSidebar}
          onToggleSidebarCollapsed={toggleSidebarCollapsed}
          isSidebarCollapsed={sidebarCollapsed}
        />
        <main className="app-main">
          {role === 'student' && hasNewNotices && (
            <div className="new-notice-banner">
              <div className="new-notice-banner-content">
                <span className="megaphone-emoji">📢</span>
                <span>
                  <strong>New Announcement:</strong> A new notice has been posted on the notice board.
                </span>
              </div>
              <button 
                onClick={() => {
                  navigate(ROUTE_PATHS.studentNoticeBoard);
                  setHasNewNotices(false);
                  localStorage.setItem('lastNoticeBoardVisit', new Date().toISOString());
                }}
                className="view-notice-btn"
              >
                View Notice
              </button>
            </div>
          )}
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