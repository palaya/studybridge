import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, getToken, setStoredUser, getStoredUser } from '../api/client';
import { initAnalytics } from '../api/analytics';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [ready, setReady] = useState(false);

  const init = useCallback(async () => {
    if (getToken() && user) {
      setReady(true);
      return;
    }
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.registerAnonymous(tz);
      setToken(res.token);
      setStoredUser(res.user);
      setUser(res.user);
    } catch (e) {
      console.error('Auth init failed:', e);
    }
    setReady(true);
  }, [user]);

  useEffect(() => {
    init();
    initAnalytics();
  }, [init]);

  const refreshUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      setStoredUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
