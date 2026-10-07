import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  // Bumped by login/logout. The startup session check can still be in flight
  // when someone signs in (a cold-start backend makes it slow), and its
  // result — sent before the login cookie existed — must not override the
  // fresh login, or keep the app showing a loader after it.
  const authVersionRef = useRef(0);

  const refreshUser = async () => {
    const response = await getCurrentUserRequest();
    setUser(response.data);
    return response.data;
  };

  useEffect(() => {
    const startedAt = authVersionRef.current;
    const isStale = () => authVersionRef.current !== startedAt;

    const initializeAuth = async () => {
      // The session lives in an httpOnly cookie now — there's no token in JS
      // to check before asking, so this call is unconditional. A 401 here
      // just means there's no session yet, which is the normal state for an
      // anonymous visitor, not something to surface as an error.
      try {
        const response = await getCurrentUserRequest();
        if (!isStale()) setUser(response.data);
      } catch {
        if (!isStale()) setUser(null);
      } finally {
        if (!isStale()) setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = (userData: AuthUser) => {
    authVersionRef.current += 1;
    setUser(userData);
    // A login settles the session, whatever the startup check is still doing.
    setIsLoading(false);
    toast.success(`Welcome back, ${userData.first_name}!`);
  };

  const logout = () => {
    authVersionRef.current += 1;
    // Best-effort — local state is cleared either way.
    api.post('/auth/logout').catch(() => {});
    setUser(null);
    setIsLoading(false);
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
