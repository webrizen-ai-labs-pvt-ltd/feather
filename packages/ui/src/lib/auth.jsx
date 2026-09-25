import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { createApi } from './api.js';

const AuthContext = createContext(null);

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* private mode — session only */
  }
};

/**
 * Holds the login session and an API client that sends the token.
 * @param {{ storageKey: string, allowedRoles: string[], children: any }} props
 */
export function AuthProvider({ storageKey, allowedRoles, children }) {
  const [session, setSession] = useState(() => read(storageKey));

  const logout = useCallback(() => {
    write(storageKey, null);
    setSession(null);
  }, [storageKey]);

  const api = useMemo(
    () => createApi({ getToken: () => read(storageKey)?.token ?? null, onUnauthorized: logout }),
    [storageKey, logout],
  );

  const login = useCallback(
    ({ token, user }) => {
      if (!allowedRoles.includes(user.role)) {
        throw new Error('Your account cannot use this app.');
      }
      const next = { token, user };
      write(storageKey, next);
      setSession(next);
    },
    [allowedRoles, storageKey],
  );

  const updateUser = useCallback(
    (user) => {
      setSession((s) => {
        const next = s ? { ...s, user } : s;
        write(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, api, login, logout, updateUser }),
    [session, api, login, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const useApi = () => useAuth().api;

/** Route guard. Not logged in → /login. Wrong role → fallback page. */
export function RequireRole({ roles, fallback = '/', children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={fallback} replace />;
  return children;
}
