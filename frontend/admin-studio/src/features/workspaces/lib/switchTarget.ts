import type { AuthUser, UserBlogMembership } from '../../auth/types';
import { canAccess, type AdminCapability } from '../../auth/lib/accessControl';

// What each top-level workspace section needs; a section the target role
// can't open falls back to the dashboard instead of an access-denied screen.
const SECTION_CAPABILITY: Record<string, AdminCapability> = {
  dashboard: 'view_dashboard',
  posts: 'manage_posts',
  tags: 'manage_tags',
  comments: 'manage_comments',
  users: 'manage_users',
  activity: 'view_audit_logs',
  settings: 'manage_settings',
};

/**
 * Where switching workspace should land, relative to the workspace root:
 * the same section the user is in now (one post → the posts list, a
 * settings tab → the same tab), or the dashboard when there's no section
 * to carry over or the new role can't open it.
 */
export const switchTargetPath = (
  pathname: string,
  fromSlug: string | null,
  target: UserBlogMembership,
  user: AuthUser | null,
): string => {
  if (!fromSlug) return '/dashboard';

  const [section, tab] = pathname
    .replace(`/admin/w/${fromSlug}`, '')
    .split('/')
    .filter(Boolean);
  const capability = section ? SECTION_CAPABILITY[section] : undefined;
  if (!capability || !canAccess(user, target, capability)) return '/dashboard';

  if (section === 'settings' && tab) return `/settings/${tab}`;
  return `/${section}`;
};
