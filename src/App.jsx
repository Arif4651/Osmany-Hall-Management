import { AppShellProvider } from './context/AppShellContext';
import { AuthProvider } from './context/AuthContext';
import { QueryCacheProvider } from './context/QueryCacheContext';
import AppRouter from './routes/AppRouter';

function App() {
  return (
    <AuthProvider>
      <QueryCacheProvider>
        <AppShellProvider>
          <AppRouter />
        </AppShellProvider>
      </QueryCacheProvider>
    </AuthProvider>
  );
}

export default App;