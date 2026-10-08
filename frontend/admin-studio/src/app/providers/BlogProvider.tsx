import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { lastWorkspace } from '../../shared/lib/blogSession';
import { pickLandingMembership, workspacePath, WORKSPACE_ROUTE_PATTERN } from '../../shared/lib/workspacePaths';
import { useAuth } from '../../features/auth/context/AuthContext';
import { switchTargetPath } from '../../features/workspaces/lib/switchTarget';
import type { MembershipBlog, UserBlogMembership } from '../../features/auth/types';

export type Blog = MembershipBlog;
export type BlogMembership = UserBlogMembership;

interface BlogContextType {
  activeBlog: Blog | null;
  activeMembership: BlogMembership | null;
  activeRole: BlogMembership['role'] | null;
  blogs: Blog[];
  memberships: BlogMembership[];
  requiresOnboarding: boolean;
  /** The slug in the URL, or null on account-level pages (profile, search, superadmin). */
  routeSlug: string | null;
  switchWorkspace: (slug: string) => void;
  isLoading: boolean;
}

const BlogContext = createContext<BlogContextType | undefined>(undefined);

/**
 * The active workspace comes from the URL (/admin/w/:workspaceSlug/...), so
 * every tab and every link carries its own. Account-level pages have no slug
 * in the URL; there the last-used workspace stands in, for the switcher and
 * for links back into a workspace.
 */
export function BlogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const routeSlug = useMatch(WORKSPACE_ROUTE_PATTERN)?.params.workspaceSlug ?? null;
  const location = useLocation();
  const navigate = useNavigate();

  const memberships = user?.blog_memberships ?? [];
  const blogs = memberships.map((membership) => membership.blog);

  const activeMembership = routeSlug
    ? memberships.find((membership) => membership.blog.slug === routeSlug) ?? null
    : pickLandingMembership(memberships);
  const activeBlog = activeMembership?.blog || null;
  const activeRole = activeMembership?.role || null;
  const requiresOnboarding = !!activeBlog && activeBlog.onboarding_status !== 'completed';

  const resolvedRouteSlug = routeSlug && activeBlog ? activeBlog.slug : null;
  useEffect(() => {
    if (resolvedRouteSlug) lastWorkspace.setSlug(resolvedRouteSlug);
  }, [resolvedRouteSlug]);

  // Client-side: cached queries are keyed by blog id, and WorkspaceRoute
  // remounts its pages when the slug changes, so nothing from the previous
  // workspace carries over. An unsaved-changes guard on the page can still
  // stop the navigation.
  const switchWorkspace = useCallback(
    (slug: string) => {
      const target = memberships.find((membership) => membership.blog.slug === slug);
      if (!target || slug === routeSlug) return;
      navigate(workspacePath(slug, switchTargetPath(location.pathname, routeSlug, target, user)));
    },
    [memberships, routeSlug, location.pathname, navigate, user],
  );

  return (
    <BlogContext.Provider
      value={{
        activeBlog,
        activeMembership,
        activeRole,
        blogs,
        memberships,
        requiresOnboarding,
        routeSlug,
        switchWorkspace,
        isLoading: isAuthLoading,
      }}
    >
      {children}
    </BlogContext.Provider>
  );
}

/** Root route element: BlogProvider has to sit inside the router to read the URL. */
export function BlogProviderOutlet() {
  return (
    <BlogProvider>
      <Outlet />
    </BlogProvider>
  );
}

export function useBlog() {
  const context = useContext(BlogContext);
  if (context === undefined) {
    throw new Error('useBlog must be used within a BlogProvider');
  }
  return context;
}
