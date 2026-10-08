import type { UserBlogMembership } from '../../features/auth/types';
import { lastWorkspace } from './blogSession';

export const WORKSPACE_ROUTE_PATTERN = '/admin/w/:workspaceSlug/*';

/** `/admin/w/{slug}{path}` — `path` starts with a slash, e.g. `/posts/new`. */
export const workspacePath = (slug: string, path = '/dashboard') => `/admin/w/${slug}${path}`;

/** The workspace slug in the current browser URL, if any. For code outside React (toasts). */
export const slugFromLocation = (pathname = window.location.pathname): string | null =>
  pathname.match(/^\/admin\/w\/([^/]+)/)?.[1] ?? null;

/**
 * The workspace to open when the URL doesn't name one: the last one used,
 * else the first membership. Pre-URL-scoping builds remembered a blog id
 * instead of a slug, so that's honoured once too.
 */
export const pickLandingMembership = (
  memberships: UserBlogMembership[],
): UserBlogMembership | null => {
  if (memberships.length === 0) return null;
  const slug = lastWorkspace.getSlug();
  const legacyId = slug ? null : lastWorkspace.getLegacyBlogId();
  return (
    memberships.find((m) => (slug ? m.blog.slug === slug : m.blog.id === legacyId)) ??
    memberships[0]
  );
};
