import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { queryClient } from '../../shared/api/queryClient';
import { BlogProvider } from './BlogProvider';

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BlogProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '16px',
                background: 'var(--admin-panel-solid)',
                color: 'var(--admin-ink)',
                border: '1px solid var(--admin-line)',
              },
            }}
          />
        </BlogProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
