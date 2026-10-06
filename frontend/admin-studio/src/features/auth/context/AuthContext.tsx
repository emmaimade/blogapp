import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { type AuthUser } from '../types';
import { getCurrentUserRequest } from '../../../shared/api/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userData: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const response = await getCurrentUserRequest();
    setUser(response.data);
    return response.data;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // The session lives in an httpOnly cookie now — there's no token in JS
      // to check before asking, so this call is unconditional. A 401 here
      // just means there's no session yet, which is the normal state for an
      // anonymous visitor, not something to surface as an error.
      try {
        await refreshUser();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = (userData: AuthUser) => {
    setUser(userData);
    toast.success(`Welcome back, ${userData.first_name}!`);
  };

  const logout = () => {
    // Best-effort — local state is cleared either way.
    api.post('/auth/logout').catch(() => {});
    setUser(null);
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
