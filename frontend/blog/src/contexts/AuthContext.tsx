import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/blogApi';

interface AuthUser {
  id: number;
  username?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // The session lives in an httpOnly cookie now — there's no token in JS
    // to check before asking, so this call is unconditional. A 401 here just
    // means there's no session yet, which is the normal state for an
    // anonymous visitor.
    api
      .get('/auth/me')
      .then((res) => {
        setUser({
          id: res.data.id,
          username: res.data.username,
          first_name: res.data.first_name,
          last_name: res.data.last_name,
          email: res.data.email,
        });
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((userData: AuthUser) => {
    setUser(userData);
  }, []);

  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    // Best-effort — local state is cleared either way.
    api.post('/auth/logout').catch(() => {});
    setUser(null);
    // Staff can open unpublished posts by direct link while signed in; drop
    // those cached post pages so a draft isn't still on screen afterwards.
    queryClient.removeQueries({ queryKey: ['post'] });
  }, [queryClient]);

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
