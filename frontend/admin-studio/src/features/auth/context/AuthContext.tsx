import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authSession } from '../lib/session';
import { type AuthUser } from '../types';
import { getCurrentUserRequest } from '../../../shared/api/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, userData: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = authSession.getToken();
    if (!token) {
      setUser(null);
      return null;
    }

    const response = await getCurrentUserRequest();
    setUser(response.data);
    return response.data;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = authSession.getToken();
      if (token) {
        try {
          await refreshUser();
        } catch (error) {
          authSession.clearToken();
          toast.error('Session expired. Please login again.');
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const login = (token: string, userData: AuthUser) => {
    authSession.setToken(token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.first_name}!`);
  };

  const logout = () => {
    authSession.clearToken();
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
