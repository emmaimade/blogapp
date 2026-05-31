import api from '../../../shared/api/client';

export interface PlatformStats {
  date?: string;
  total_blogs: number;
  active_blogs: number;
  total_users: number;
  total_posts: number;
  total_views?: number;
  blogs_created_today: number;
  users_signed_up_today: number;
  revenue: number;
}

export interface BlogAnalytics {
  blog_id: number;
  blog_name: string;
  owner_email: string;
  total_posts: number;
  total_views: number;
  team_members: number;
  created_at: string;
  last_activity?: string | null;
  plan: string;
  is_active?: boolean;
  subdomain?: string;
}

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const result = await api.get('/superadmin/stats');
  return result.data;
};

export const getBlogAnalytics = async (): Promise<BlogAnalytics[]> => {
  const result = await api.get('/superadmin/blogs');
  return result.data;
};
