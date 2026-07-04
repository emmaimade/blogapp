import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authSession } from '../lib/session';
import { useBlog } from '../../../app/providers/BlogProvider';
import { canAccess, getAccessSummary, type AdminCapability } from '../lib/accessControl';

interface ProtectedRouteProps {
  requiredCapability?: AdminCapability;
}

export const ProtectedRoute = ({ requiredCapability = 'access_admin_studio' }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const { memberships, activeMembership, isLoading: isBlogLoading } = useBlog();
  const location = useLocation(); // NEW: Hook into the active router path context

  if (isLoading || isBlogLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--admin-bg)] px-4">
        <div className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  // 1. Ensure the user is authenticated first
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // 2. NEW: Intercept unverified accounts and drop them behind the isolation wall
  if (!user.email_verified) {
    // If they are already trying to view the quarantine page, let them through!
    if (location.pathname === '/admin/verify-quarantine') {
      return <Outlet />;
    }
    // Otherwise, block access to any other layout routes and redirect them
    return <Navigate to="/admin/verify-quarantine" replace />;
  }

  // 3. If they are verified and try to visit the quarantine route manually, bounce them to safety
  if (location.pathname === '/admin/verify-quarantine') {
    return <Navigate to="/admin" replace />;
  }

  // 4. Standard capability and access controls proceed normally for verified users
  const isAllowed = canAccess(user, activeMembership, requiredCapability);
  const accessSummary = getAccessSummary(user, memberships, activeMembership);

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--admin-bg)] px-4">
        <div className="admin-card w-full max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full bg-red-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-red-600 dark:bg-red-950/60 dark:text-red-300">
            Access denied
          </div>
          <h2 className="mb-3 text-3xl font-bold text-zinc-900 dark:text-white">{accessSummary.title}</h2>
          <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {accessSummary.description}
          </p>

          <div className="admin-note mb-6 rounded-2xl p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Signed in as</p>
            <p className="mt-2 font-semibold text-zinc-900 dark:text-white">{user.username}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{user.email}</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Role: {user.platform_role}</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Workspaces: {memberships.length}</p>
            {activeMembership && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Active workspace role: {activeMembership.role}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => {
                authSession.clearToken();
                window.location.href = '/admin/login';
              }}
              className="admin-btn admin-btn-primary px-6 py-3 text-sm"
            >
              Logout & Re-login
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="admin-btn admin-btn-secondary px-6 py-3 text-sm"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};