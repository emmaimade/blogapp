import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { toastApiError } from '../../../shared/lib/apiErrors';
import type { StatsRange } from '../../dashboard/hooks/useAnalytics';

export interface AnalyticsTotals {
  views: number;
  visitors: number;
  new_followers: number;
  unsubscribes: number;
}

export interface OverviewDay extends AnalyticsTotals {
  day: string; // YYYY-MM-DD, UTC
}

export interface AnalyticsOverview {
  range: StatsRange;
  days: OverviewDay[];
  totals: AnalyticsTotals;
  /** The period just before; null when that's further back than the plan's history. */
  previous_totals: AnalyticsTotals | null;
  sources: { source: string; visits: number }[];
  follower_posts: { id: number; title: string; slug: string; followers: number }[];
  history_days: number | null;
  can_export: boolean;
}

export type PostSort = 'views' | 'followers' | 'newest';

export interface PostRow {
  id: number;
  title: string;
  slug: string;
  published_at: string | null;
  views_in_range: number;
  lifetime_views: number;
  followers_gained: number;
}

interface PostPage {
  items: PostRow[];
  total: number;
  has_more: boolean;
}

export const POSTS_PAGE_SIZE = 20;

export const useAnalyticsOverview = (range: StatsRange) => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  return useQuery<AnalyticsOverview>({
    queryKey: ['analyticsOverview', blogId, range],
    queryFn: async () => (await api.get(`/blogs/${blogId}/analytics/overview`, { params: { range } })).data,
    enabled: !!blogId,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
};

export const usePostAnalytics = (range: StatsRange, sort: PostSort, page: number) => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  return useQuery<PostPage>({
    queryKey: ['analyticsPosts', blogId, range, sort, page],
    queryFn: async () =>
      (await api.get(`/blogs/${blogId}/analytics/posts`, {
        params: { range, sort, skip: page * POSTS_PAGE_SIZE, limit: POSTS_PAGE_SIZE },
      })).data,
    enabled: !!blogId,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
};

export const useExportAnalytics = () => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  return useMutation({
    mutationFn: async (range: StatsRange) => {
      const res = await api.get(`/blogs/${blogId}/analytics/export`, { params: { range }, responseType: 'blob' });
      const disposition = String(res.headers['content-disposition'] ?? '');
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'analytics.csv';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Export downloaded.'),
    onError: (error) => toastApiError(error, "Couldn't export analytics."),
  });
};
