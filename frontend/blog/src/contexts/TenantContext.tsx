import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

interface Blog {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
}

interface TenantContextType {
  blog: Blog | null;
  isLoading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        
        let subdomain = parts[0];
        // simple localhost fallback to 'myblog' unless overriden by hosts file
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            subdomain = import.meta.env.VITE_BLOG_SLUG || 'myblog';
        } else if (parts.length > 2 && parts[0] === 'www') {
            subdomain = parts[1];
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await axios.get(`${API_URL}/blogs/by-subdomain/${subdomain}`);
        setBlog(res.data);
        localStorage.setItem('public_blog_id', res.data.id.toString());
      } catch (err) {
        console.error("Failed to load tenant:", err);
        setError("Blog not found or inactive.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenant();
  }, []);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#666' }}>
        Loading blog...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ blog, isLoading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
