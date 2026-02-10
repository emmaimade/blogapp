// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User } from '../types';
import api from '../api/client';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean; 
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Verify token and get fresh user data from backend
          const response = await api.get('/users/me'); 
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          toast.error("Session expired. Please login again.");
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.username}!`);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};