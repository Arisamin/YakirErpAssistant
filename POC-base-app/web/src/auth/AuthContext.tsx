import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokens } from '../api/client';
import type { Me } from '../types';

interface AuthState {
  me: Me | null;
  loading: boolean;
  reloadMe: () => Promise<void>;
  logout: () => void;
  can: (menuKey: string, action: 'view' | 'write' | 'delete') => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function reloadMe() {
    if (!tokens.access) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe(await api.me());
    } catch {
      tokens.clear();
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadMe();
  }, []);

  function logout() {
    api.logout();
    setMe(null);
  }

  function can(menuKey: string, action: 'view' | 'write' | 'delete') {
    const p = me?.permissions.find((x) => x.menuKey === menuKey);
    return !!p && !!p[action];
  }

  return (
    <AuthContext.Provider value={{ me, loading, reloadMe, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
