import type { AuthUser } from '../types';
import type { BlogMembership } from '../../../app/providers/BlogProvider';

export type AdminCapability =
  | 'access_admin_studio'
  | 'view_dashboard'
  | 'manage_posts'
  | 'manage_tags'
  | 'manage_comments'
  | 'manage_users'
  | 'manage_settings'
  | 'view_audit_logs'
  | 'view_platform_stats';

const BLOG_MEMBER_CAPABILITIES: AdminCapability[] = [
  'access_admin_studio',
  'view_dashboard',
];

const SUPER_ADMIN_CAPABILITIES: AdminCapability[] = [
  ...BLOG_MEMBER_CAPABILITIES,
  'manage_posts',
  'manage_tags',
  'manage_comments',
  'manage_users',
  'manage_settings',
  'view_audit_logs',
  'view_platform_stats',
];

const ROLE_CAPABILITIES: Record<NonNullable<BlogMembership['role']>, AdminCapability[]> = {
  owner: [...BLOG_MEMBER_CAPABILITIES, 'manage_posts', 'manage_tags', 'manage_comments', 'manage_users', 'manage_settings', 'view_audit_logs'],
  editor: [...BLOG_MEMBER_CAPABILITIES, 'manage_posts', 'manage_tags', 'manage_comments', 'view_audit_logs'],
  author: [...BLOG_MEMBER_CAPABILITIES, 'manage_posts'],
};

const normalizeRole = (role?: string | null) => role?.toLowerCase() ?? 'user';

export const isSuperAdmin = (user: AuthUser | null) =>
  !!user && (user.is_super_admin || normalizeRole(user.platform_role) === 'super_admin');

export const hasBlogAccess = (memberships: BlogMembership[] | null | undefined) => (memberships?.length ?? 0) > 0;

export const getAdminCapabilities = (
  user: AuthUser | null,
  activeMembership: BlogMembership | null | undefined,
): Set<AdminCapability> => {
  if (!user) {
    return new Set();
  }

  if (isSuperAdmin(user)) {
    return new Set(SUPER_ADMIN_CAPABILITIES);
  }

  if (activeMembership) {
    return new Set(ROLE_CAPABILITIES[activeMembership.role]);
  }

  return new Set();
};

export const canAccess = (
  user: AuthUser | null,
  activeMembership: BlogMembership | null | undefined,
  capability: AdminCapability,
) => getAdminCapabilities(user, activeMembership).has(capability);

export const getAccessSummary = (
  user: AuthUser | null,
  memberships: BlogMembership[] | null | undefined,
  activeMembership: BlogMembership | null | undefined,
) => {
  if (!user) {
    return {
      title: 'Authentication required',
      description: 'Please sign in to continue.',
    };
  }

  if (isSuperAdmin(user)) {
    return {
      title: 'Super admin access granted',
      description: 'You can access platform-wide controls and every blog workspace.',
    };
  }

  if (activeMembership) {
    return {
      title: `${activeMembership.blog.name} workspace`,
      description: `You are signed into this tenant as ${activeMembership.role}.`,
    };
  }

  if (hasBlogAccess(memberships)) {
    return {
      title: 'Workspace selection required',
      description: 'Select an active blog workspace to continue with tenant-scoped actions.',
    };
  }

  return {
    title: 'No workspace assigned',
    description: 'This account is signed in, but it is not assigned to any blog workspace yet.',
  };
};
