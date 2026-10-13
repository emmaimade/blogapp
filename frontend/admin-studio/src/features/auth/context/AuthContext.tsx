import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { type AuthUser } from '../types';
import { getCurrentUserRequest } from '../../../shared/api/auth';

// Retries for the startup session check when the server can't answer —
// about 15 seconds in all, enough to ride out a database reconnect.
const SESSION_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** No answer, a server error, a timeout or rate limit: worth asking again. */
const isTransientFailure = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === undefined || status >= 500 || status === 408 || status === 429;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** The startup check couldn't reach the server, even after retrying. Not the same as signed out. */
  isUnreachable: boolean;
  /** Asks the server again after isUnreachable. */
  retrySession: () => void;
  login: (userData: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnreachable, setIsUnreachable] = useState(false);
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

  const checkSession = useCallback(async () => {
    const startedAt = authVersionRef.current;
    const isStale = () => authVersionRef.current !== startedAt;

    // The session lives in an httpOnly cookie — there's no token in JS to
    // check before asking, so this call is unconditional. A 401 just means
    // there's no session yet, the normal state for an anonymous visitor.
    // A server error or no network says nothing about the session, so those
    // are retried, and if the server stays out of reach the user is told so
    // rather than sent to the login page.
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await getCurrentUserRequest();
        if (!isStale()) setUser(response.data);
        break;
      } catch (error) {
        if (isStale()) return;
        if (!isTransientFailure(error)) {
          setUser(null);
          break;
        }
        if (attempt >= SESSION_RETRY_DELAYS_MS.length) {
          setIsUnreachable(true);
          break;
        }
        await wait(SESSION_RETRY_DELAYS_MS[attempt]);
        if (isStale()) return;
      }
    }
    if (!isStale()) setIsLoading(false);
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const retrySession = () => {
    setIsUnreachable(false);
    setIsLoading(true);
    checkSession();
  };

  const login = (userData: AuthUser) => {
    authVersionRef.current += 1;
    setIsUnreachable(false);
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
    <AuthContext.Provider
      value={{ user, login, logout, refreshUser, isLoading, isAuthenticated: !!user, isUnreachable, retrySession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
