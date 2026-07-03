import { useQuery } from '@tanstack/react-query';
import api from '../../../shared/api/client';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import { canAccess } from '../../auth/lib/accessControl';

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  time: string;
}

export interface DashboardSummary {
  blog_id: number;
  blog_name: string;
  role: 'owner' | 'editor' | 'author';
  posts: number;
  published_posts: number;
  draft_posts: number;
  scheduled_posts: number;
  comments: number;
  tags: number;
  team_members: number;
  total_views: number;
  recent_activity: ActivityItem[];
}

export const useDashboard = () => {
  const { user } = useAuth();
  const { activeBlog, activeMembership } = useBlog();

  const permissions = {
    canManagePosts: canAccess(user, activeMembership, 'manage_posts'),
    canManageSettings: canAccess(user, activeMembership, 'manage_settings'),
    canManageUsers: canAccess(user, activeMembership, 'manage_users'),
    canManageComments: canAccess(user, activeMembership, 'manage_comments'),
    canManageTags: canAccess(user, activeMembership, 'manage_tags'),
  };

  const { data, isLoading, error, refetch } = useQuery<DashboardSummary>({
    queryKey: ['blogDashboard', activeMembership?.blog_id],
    queryFn: async () => (await api.get('/dashboard')).data,
    enabled: !!activeMembership,
    refetchInterval: 30000,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog?.id}/subscription`)).data,
    enabled: !!activeBlog?.id,
  });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date().toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  return {
    user,
    activeBlog,
    permissions,
    data,
    isLoading,
    error,
    refetch,
    subscription,
    greeting: getGreeting(),
    today,
    isOwner: data?.role === 'owner',
  };
};