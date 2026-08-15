import { AppShellProvider } from './context/AppShellContext';
import { AuthProvider } from './context/AuthContext';
import { QueryCacheProvider } from './context/QueryCacheContext';
import { ToastProvider } from './context/ToastContext';
import AppRouter from './routes/AppRouter';

function App() {
  return (
    <AuthProvider>
      <QueryCacheProvider>
        <ToastProvider>
          <AppShellProvider>
            <AppRouter />
          </AppShellProvider>
        </ToastProvider>
      </QueryCacheProvider>
    </AuthProvider>
  );
}

export default App;