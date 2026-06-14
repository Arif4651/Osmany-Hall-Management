import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiRequest,
  AUTH_UNAUTHORIZED_EVENT,
  setAccessToken,
} from '../services/apiClient';

const STORAGE_KEY = 'osmany-hall-auth-session-v1';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const user = await apiRequest('/auth/me');
        if (isMounted) {
          setSession((prev) => ({
            user,
            accessToken: prev?.accessToken || null,
            loggedInAt: prev?.loggedInAt || new Date().toISOString(),
          }));
        }
      } catch {
        setAccessToken('');
        if (isMounted) setSession(null);
      } finally {
        if (isMounted) setIsSessionLoading(false);
      }
    }

    hydrateSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const authenticate = useCallback(async ({ email, password, allowedRole }) => {
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, role: allowedRole }),
      });

      setAccessToken(response.accessToken);

      const nextSession = {
        user: response.user,
        accessToken: response.accessToken,
        expiresAtUtc: response.expiresAtUtc,
        loggedInAt: new Date().toISOString(),
      };

      setSession(nextSession);
      return { ok: true, user: nextSession.user };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Invalid credentials. Please try again.',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Logging out locally is still valid when the token is already expired.
    }
    setAccessToken('');
    setSession(null);
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const user = await apiRequest('/auth/me');
      setSession((prev) => (prev ? { ...prev, user } : prev));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Password change failed.',
      };
    }
  }, []);

  const value = useMemo(
    () => ({
      isSessionLoading,
      isAuthenticated: Boolean(session),
      user: session?.user ?? null,
      role: session?.user?.role ?? null,
      mustChangePassword: Boolean(session?.user?.mustChangePassword),
      loginStudent: ({ email, password }) => authenticate({ email, password, allowedRole: 'student' }),
      loginAdmin: ({ email, password }) => authenticate({ email, password, allowedRole: 'admin' }),
      changePassword,
      logout,
    }),
    [session, isSessionLoading, authenticate, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
