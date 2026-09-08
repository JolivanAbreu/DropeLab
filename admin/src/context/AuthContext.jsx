import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getAccessToken, setTokens, clearTokens, ApiError } from '../api/client';

const AuthContext = createContext(null);
const STORAGE_KEY = 'bos_admin_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getAccessToken()) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/login', { email, password }, { auth: false });

    if (data.requires_two_factor) {
      return { requiresTwoFactor: true, twoFactorToken: data.two_factor_token };
    }

    if (!['admin', 'operator'].includes(data.user.role)) {
      throw new ApiError(403, 'forbidden', 'Esta conta não tem acesso ao painel administrativo.');
    }

    setTokens(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return { requiresTwoFactor: false, user: data.user };
  }, []);

  const completeTwoFactorLogin = useCallback(async (twoFactorToken, code) => {
    const data = await api.post('/login/2fa', { two_factor_token: twoFactorToken, code }, { auth: false });

    if (!['admin', 'operator'].includes(data.user.role)) {
      throw new ApiError(403, 'forbidden', 'Esta conta não tem acesso ao painel administrativo.');
    }

    setTokens(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateStoredUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeTwoFactorLogin, logout, isAuthenticated: !!user, isAdmin: user?.role === 'admin', setUser: updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
