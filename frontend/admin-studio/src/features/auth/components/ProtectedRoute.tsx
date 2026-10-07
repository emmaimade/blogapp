import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import { canAccess, getAccessSummary, type AdminCapability } from '../lib/accessControl';
import { AdminShellSkeleton } from '../../../shared/ui/AdminShellSkeleton';

interface ProtectedRouteProps {
  requiredCapability?: AdminCapability;
}

export const ProtectedRoute = ({ requiredCapability = 'access_admin_studio' }: ProtectedRouteProps) => {
  const { user, isLoading, logout } = useAuth();
  const { memberships, activeMembership, isLoading: isBlogLoading } = useBlog();

  // Only the startup session check gets here (a refresh or an admin link) —
  // signing in settles the session immediately. Until it's known whether
  // anyone's signed in, show the layout's outline rather than a spinner.
  if (isLoading || isBlogLoading) {
    return <AdminShellSkeleton />;
  }

  // 1. Ensure the user is authenticated first
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // 2. Standard capability and access controls proceed normally
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