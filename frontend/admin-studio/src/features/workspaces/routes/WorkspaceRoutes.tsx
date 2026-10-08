import { Navigate, Outlet, useLocation, useMatch } from 'react-router-dom';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useAuth } from '../../auth/context/AuthContext';
import { getPostLoginPath, isSuperAdmin } from '../../auth/lib/accessControl';
import { pickLandingMembership, workspacePath } from '../../../shared/lib/workspacePaths';
import { WorkspaceStateScreen } from '../components/WorkspaceStateScreen';

/**
 * Wraps every /admin/w/:workspaceSlug route. BlogProvider has already
 * resolved the slug against the user's memberships; this turns a miss into
 * an explanation instead of silently opening some other workspace, and
 * holds an unfinished workspace on its onboarding before any page under it
 * mounts and starts fetching.
 */
export const WorkspaceRoute = () => {
  const { user } = useAuth();
  const { activeMembership, memberships, requiresOnboarding } = useBlog();
  const onOnboarding = !!useMatch('/admin/w/:workspaceSlug/onboarding');

  if (!activeMembership) {
    const landing = pickLandingMembership(memberships);
    return landing ? (
      <WorkspaceStateScreen kind="not-found" fallbackPath={workspacePath(landing.blog.slug)} />
    ) : (
      <WorkspaceStateScreen kind="none" />
    );
  }

  const needsSetup = (requiresOnboarding || !user?.email_verified) && !isSuperAdmin(user);
  if (needsSetup && !onOnboarding) {
    return <Navigate to={workspacePath(activeMembership.blog.slug, '/onboarding')} replace />;
  }

  return <Outlet />;
};

/**
 * Pre-URL-scoping paths (/admin/dashboard, /admin/posts/view/5, …) still
 * arrive from bookmarks, emails and stored notifications. Every link the
 * backend generates carries `?blog={id}`, which picks the workspace;
 * otherwise the last-used one does. The rest of the path and the query
 * string are kept.
 */
export const LegacyWorkspaceRedirect = () => {
  const { user } = useAuth();
  const { memberships } = useBlog();
  const location = useLocation();

  if (!user) return null;

  const blogParam = Number(new URLSearchParams(location.search).get('blog'));
  const target =
    memberships.find((membership) => membership.blog.id === blogParam) ??
    pickLandingMembership(memberships);

  if (!target) {
    return <Navigate to={isSuperAdmin(user) ? '/admin/superadmin' : '/admin'} replace />;
  }

  const rest = location.pathname.replace(/^\/admin/, '');
  return <Navigate to={`${workspacePath(target.blog.slug, rest)}${location.search}${location.hash}`} replace />;
};

/** /admin: send the user to the right place, or explain why there's nowhere to go. */
export const DefaultAdminRedirect = () => {
  const { user } = useAuth();
  if (!user) return null;

  const target = getPostLoginPath(user);
  if (target === '/admin') return <WorkspaceStateScreen kind="none" />;
  return <Navigate to={target} replace />;
};
