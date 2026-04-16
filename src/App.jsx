import { AppShellProvider } from './context/AppShellContext';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './routes/AppRouter';

function App() {
  return (
    <AuthProvider>
      <AppShellProvider>
        <AppRouter />
      </AppShellProvider>
    </AuthProvider>
  );
}

export default App;