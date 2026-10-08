import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../../features/auth/context/AuthContext';
import { queryClient } from '../../shared/api/queryClient';

// BlogProvider is mounted by the router (BlogProviderOutlet) since the
// active workspace is read from the URL.
export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
      </AuthProvider>
    </QueryClientProvider>
  );
};
