import { createContext, useContext, useMemo, useState } from 'react';

const AppShellContext = createContext(null);

export function AppShellProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const value = useMemo(
    () => ({
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),
      toggleSidebar: () => setSidebarOpen((prev) => !prev),
    }),
    [sidebarOpen],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }

  return context;
}