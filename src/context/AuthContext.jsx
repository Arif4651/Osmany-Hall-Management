import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiRequest,
  AUTH_UNAUTHORIZED_EVENT,
  isSessionExpired,
} from '../services/apiClient';
import { queryCache } from '../services/queryCache';
import { permissionService } from '../services/permissionService';

// Stores only non-sensitive session metadata (user info + expiry).
// The JWT itself lives in an HttpOnly cookie and is never accessible to JavaScript.
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

function hasUsableStoredSession(session) {
  // Session is valid if there is user data and the recorded expiry has not passed.
  // The actual JWT expiry is enforced server-side; this is just a client-side
  // optimistic check to skip a redundant /auth/me call on fresh page loads.
  return Boolean(session?.user && !isSessionExpired(session.expiresAtUtc));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [isSessionLoading, setIsSessionLoading] = useState(() => {
    const storedSession = readStoredSession();
    return !hasUsableStoredSession(storedSession);
  });

  // Grants are always fetched from the server, never persisted alongside the session — a super
  // admin revoking access must take effect on the next load, not whenever localStorage expires.
  const [permissions, setPermissions] = useState(null);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);

  // Persist non-sensitive session metadata to localStorage so the user
  // appears logged-in across page refreshes without an immediate /auth/me round-trip.
  useEffect(() => {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  useEffect(() => {
    const handleUnauthorized = () => {
      queryCache.clear();
      setSession(null);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      // If we have a locally-stored session that hasn't expired yet, skip the
      // /auth/me round-trip and trust the stored metadata. The cookie will be
      // validated by the server on the next real API call.
      const stored = readStoredSession();
      if (hasUsableStoredSession(stored)) {
        if (isMounted) setIsSessionLoading(false);
        return;
      }

      // No valid local session — ask the server to verify the cookie.
      try {
        const user = await apiRequest('/auth/me');
        if (isMounted) {
          setSession((prev) => ({
            user,
            expiresAtUtc: prev?.expiresAtUtc || null,
            loggedInAt: prev?.loggedInAt || new Date().toISOString(),
          }));
        }
      } catch {
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

  // Reload grants whenever the signed-in identity changes.
  const userId = session?.user?.id ?? null;
  const userRole = session?.user?.role ?? null;
  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setPermissions(null);
      setIsPermissionsLoading(false);
      return undefined;
    }

    setIsPermissionsLoading(true);
    permissionService
      .getMyPermissions()
      .then((result) => {
        if (isMounted) setPermissions(result);
      })
      .catch(() => {
        // A failed load must not silently widen access for anyone else — fall back to "nothing
        // granted". Super admin is the one exception: the role itself (already verified at login,
        // independent of this call) is enough to grant full access, so a broken/unseeded
        // permissions endpoint can never lock a super admin out of their own hall.
        if (isMounted) {
          const isSuper = userRole === 'super_admin';
          setPermissions({ role: isSuper ? userRole : '', isSuperAdmin: isSuper, permissions: [] });
        }
      })
      .finally(() => {
        if (isMounted) setIsPermissionsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, userRole]);

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissions(await permissionService.getMyPermissions());
    } catch {
      // Keep the previous grants rather than dropping the user to no-access on a transient error.
    }
  }, []);

  const authenticate = useCallback(async ({ email, password, allowedRole }) => {
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, role: allowedRole }),
      });

      // The JWT is now set by the server as an HttpOnly cookie — response only
      // contains { expiresAtUtc, user }.
      queryCache.clear();

      const nextSession = {
        user: response.user,
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
      // The server clears the HttpOnly cookie in its response headers.
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Logging out locally is still valid when the token is already expired.
    }
    queryCache.clear();
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

      // The permissions effect above only re-runs when userId/userRole change, and neither does
      // here — so without this, a fresh account whose first-ever /permissions/me call landed
      // while MustChangePassword was still true (and was refused, falling back to "nothing
      // granted") would stay locked out of every page for the rest of the session even after
      // successfully changing the password.
      try {
        setPermissions(await permissionService.getMyPermissions());
      } catch {
        // Leave the fallback in place; the user can still reload to pick up a working fetch.
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Password change failed.',
      };
    }
  }, []);

  // menuKey -> { canView, canCreate, canEdit, canDelete }
  const grantsByMenu = useMemo(() => {
    const map = new Map();
    for (const row of permissions?.permissions ?? []) {
      map.set(row.menuKey, row);
    }
    return map;
  }, [permissions]);

  const isSuperAdmin = Boolean(permissions?.isSuperAdmin);

  /**
   * Whether the signed-in role may perform `action` on `menuKey`.
   * Client-side gating only — every guarded endpoint re-checks server-side.
   */
  const can = useCallback(
    (menuKey, action = 'view') => {
      if (isSuperAdmin) return true;
      const grant = grantsByMenu.get(menuKey);
      if (!grant) return false;
      switch (action) {
        case 'create': return Boolean(grant.canCreate);
        case 'edit': return Boolean(grant.canEdit);
        case 'delete': return Boolean(grant.canDelete);
        default: return Boolean(grant.canView);
      }
    },
    [grantsByMenu, isSuperAdmin],
  );

  const value = useMemo(
    () => ({
      isSessionLoading,
      isAuthenticated: Boolean(session),
      user: session?.user ?? null,
      role: session?.user?.role ?? null,
      mustChangePassword: Boolean(session?.user?.mustChangePassword),
      isPermissionsLoading,
      isSuperAdmin,
      can,
      // When true the financial screens offer a wing selector instead of locking to user.wing.
      canChooseFinanceWing: Boolean(permissions?.canChooseFinanceWing),
      permissions: permissions?.permissions ?? [],
      refreshPermissions,
      loginStudent: ({ email, password }) => authenticate({ email, password, allowedRole: 'student' }),
      loginAdmin: ({ email, password }) => authenticate({ email, password, allowedRole: 'admin' }),
      changePassword,
      logout,
    }),
    [
      session, isSessionLoading, authenticate, changePassword, logout,
      isPermissionsLoading, isSuperAdmin, can, permissions, refreshPermissions,
    ],
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
