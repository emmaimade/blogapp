import { useQuery } from '@tanstack/react-query';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

export type StatsRange = '7d' | '30d' | '90d' | '12m';

export const STATS_RANGES: { key: StatsRange; label: string; days: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '12m', label: '12 months', days: 365 },
];

export interface AnalyticsDay {
  day: string; // YYYY-MM-DD, UTC
  views: number;
  /** null for authors: visitors are blog-wide. */
  visitors: number | null;
}

export interface BlogAnalytics {
  range: StatsRange;
  days: AnalyticsDay[];
  total_views: number;
  total_visitors: number | null;
  top_posts: { id: number; title: string; slug: string; views: number }[];
  /** How far back the plan allows; null for superadmins. */
  history_days: number | null;
}

/** Daily views and visitors for the active workspace, from GET /blogs/{id}/analytics. */
export const useAnalytics = (range: StatsRange) => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;

  return useQuery<BlogAnalytics>({
    queryKey: ['blogAnalytics', blogId, range],
    queryFn: async () => (await api.get(`/blogs/${blogId}/analytics`, { params: { range } })).data,
    enabled: !!blogId,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
};
