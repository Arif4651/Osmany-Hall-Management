import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_USERS } from '../data/mock/authUsers';

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

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  const authenticate = useCallback(({ email, password, allowedRole }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const foundUser = AUTH_USERS.find(
      (user) =>
        user.email.toLowerCase() === normalizedEmail &&
        user.password === password &&
        user.role === allowedRole,
    );

    if (!foundUser) {
      return { ok: false, message: 'Invalid credentials. Please try again.' };
    }

    const nextSession = {
      user: {
        id: foundUser.id,
        fullName: foundUser.fullName,
        email: foundUser.email,
        role: foundUser.role,
        designation: foundUser.designation,
      },
      loggedInAt: new Date().toISOString(),
    };

    setSession(nextSession);
    return { ok: true, user: nextSession.user };
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session),
      user: session?.user ?? null,
      role: session?.user?.role ?? null,
      loginStudent: ({ email, password }) => authenticate({ email, password, allowedRole: 'student' }),
      loginAdmin: ({ email, password }) => authenticate({ email, password, allowedRole: 'admin' }),
      logout: () => setSession(null),
    }),
    [session, authenticate],
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
