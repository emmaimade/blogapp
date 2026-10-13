import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CloudOff, RotateCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import {
  VERIFY_EMAIL_PATH,
  canAccess,
  getAccessSummary,
  needsEmailVerification,
  type AdminCapability,
} from '../lib/accessControl';
import { AdminShellSkeleton } from '../../../shared/ui/AdminShellSkeleton';
import { useStoredTheme } from '../../../shared/lib/theme';

interface ProtectedRouteProps {
  /** `null` checks sign-in only, for routes that explain missing access themselves. */
  requiredCapability?: AdminCapability | null;
}

export const ProtectedRoute = ({ requiredCapability = 'access_admin_studio' }: ProtectedRouteProps) => {
  const { user, isLoading, logout, isUnreachable, retrySession } = useAuth();
  const { memberships, activeMembership, isLoading: isBlogLoading } = useBlog();
  const location = useLocation();
  // The access-denied screen below renders outside AdminLayout, which owns the theme.
  useStoredTheme();

  // Only the startup session check gets here (a refresh or an admin link) —
  // signing in settles the session immediately. Until it's known whether
  // anyone's signed in, show the layout's outline rather than a spinner.
  if (isLoading || isBlogLoading) {
    return <AdminShellSkeleton />;
  }

  // The server couldn't say who's signed in. That isn't "signed out": the
  // session cookie is untouched, so trying again picks up where they were.
  if (isUnreachable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--admin-bg)] px-4">
        <div role="alert" className="admin-card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <CloudOff size={22} aria-hidden="true" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-white">Can't reach Inko right now</h1>
          <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            This is usually brief. You're still signed in, and nothing has been lost.
          </p>
          <button
            type="button"
            onClick={retrySession}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <RotateCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // 1. Ensure the user is authenticated first
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // 2. Nothing in the studio opens until the signup email is confirmed.
  if (needsEmailVerification(user) && location.pathname !== VERIFY_EMAIL_PATH) {
    return <Navigate to={VERIFY_EMAIL_PATH} replace />;
  }

  // 3. Standard capability and access controls proceed normally
  const isAllowed =
    requiredCapability === null || canAccess(user, activeMembership, requiredCapability);
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
                logout();
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