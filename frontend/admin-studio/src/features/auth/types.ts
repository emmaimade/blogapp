export type PlatformRole = 'super_admin' | 'user';

export type BlogRole = 'owner' | 'editor' | 'author';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';
export type OnboardingStep = 'about' | 'profile' | 'publication' | 'team' | 'plan';

export interface MembershipBlog {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  custom_domain?: string | null;
  is_active: boolean;
  owner_id: number;
   onboarding_status: OnboardingStatus;
   onboarding_step: OnboardingStep;
   onboarding_completed_at?: string | null;
}

export interface UserBlogMembership {
  id: number;
  user_id: number;
  blog_id: number;
  role: BlogRole;
  invited_at: string;
  blog: MembershipBlog;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  platform_role: PlatformRole;
  is_super_admin: boolean;
  is_active?: boolean;
  blog_memberships: UserBlogMembership[];
}
