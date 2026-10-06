import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, SearchX } from 'lucide-react';
import { PageLoader } from '../components/PageLoader';
import api from '../api/blogApi';
import { getErrorStatus } from '../api/errors';

interface Blog {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tagline?: string | null;
  comments_enabled: boolean;
}

// Interim tab title from the resolved tenant alone, so the tab is branded
// while site settings are still loading; each page's usePageMeta/applyPageMeta
// refines it once they arrive. Mirrors Home's "{name} - {tagline}" rule.
const applyTenantTitle = (tenant: Blog) => {
  const isHome = window.location.pathname === '/';
  document.title = isHome && tenant.tagline ? `${tenant.name} - ${tenant.tagline}` : tenant.name;
};

interface TenantContextType {
  blog: Blog | null;
  isLoading: boolean;
  error: string | null;
}

type FetchState = 'loading' | 'ready' | 'not-found' | 'network-error';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [state, setState] = useState<FetchState>('loading');
  const queryClient = useQueryClient();

  const fetchTenant = useCallback(async () => {
    setState('loading');
    try {
      const hostname = window.location.hostname;

      // Local dev has no meaningful hostname to resolve against — the backend
      // can't know about that convention, so this fallback stays client-side.
      const effectiveHost =
        hostname === 'localhost' || hostname === '127.0.0.1'
          ? `${import.meta.env.VITE_BLOG_SLUG || 'myblog'}.inko.blog`
          : hostname;

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await axios.get(`${API_URL}/blogs/resolve`, { params: { host: effectiveHost } });
      setBlog(res.data);
      applyTenantTitle(res.data);
      localStorage.setItem('public_blog_id', res.data.id.toString());

      // Prime the site-settings cache with this tenant's real branding before
      // children (Navbar/Footer) ever mount, so they never render on the
      // neutral placeholder — useSiteSettings only falls back to that
      // if this fetch fails.
      try {
        const settingsRes = await api.get('/settings/public');
        queryClient.setQueryData(['allSettings'], settingsRes.data);
      } catch (settingsErr) {
        console.error('Failed to preload site settings:', settingsErr);
      }

      setState('ready');
    } catch (err) {
      console.error("Failed to load tenant:", err);
      setState(getErrorStatus(err) === 404 ? 'not-found' : 'network-error');
    }
  }, [queryClient]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  if (state === 'loading') {
    return <PageLoader label="Loading blog" minHeight="100vh" />;
  }

  if (state === 'not-found' || state === 'network-error') {
    const isNetworkError = state === 'network-error';
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 px-6">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 dark:bg-zinc-800">
          {isNetworkError ? (
            <AlertTriangle className="text-zinc-400" size={28} />
          ) : (
            <SearchX className="text-zinc-400" size={28} />
          )}
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          {isNetworkError ? 'Something went wrong' : 'Blog not found'}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-sm">
          {isNetworkError
            ? "We couldn't reach the server. Check your connection and try again."
            : "This blog doesn't exist or is no longer active."}
        </p>
        {isNetworkError && (
          <button
            onClick={fetchTenant}
            className="px-6 py-2.5 bg-zinc-900 text-white rounded-full font-bold hover:bg-zinc-800 transition-all dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ blog, isLoading: false, error: null }}>
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
