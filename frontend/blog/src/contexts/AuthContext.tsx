import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/blogApi';

interface AuthUser {
  id: number;
  username?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser, refreshToken?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Validate the stored token against the backend rather than trusting
    // localStorage blindly — a stale or forged userId shouldn't grant "this
    // is my comment" UI to the wrong visitor.
    api
      .get('/auth/me')
      .then((res) => {
        const authUser: AuthUser = { id: res.data.id, username: res.data.username };
        setUser(authUser);
        localStorage.setItem('userId', String(authUser.id));
        if (authUser.username) localStorage.setItem('username', authUser.username);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((token: string, userData: AuthUser, refreshToken?: string) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('userId', String(userData.id));
    if (userData.username) localStorage.setItem('username', userData.username);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      // Best-effort — local state is cleared either way.
      api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
