import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { toastApiError } from '../../../shared/lib/apiErrors';

export type FollowerStatus = 'active' | 'pending' | 'unsubscribed';

export interface Follower {
  id: number;
  email: string;
  status: FollowerStatus;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  source_post: { id: number; title: string; slug: string } | null;
}

export interface FollowerSummary {
  active: number;
  pending: number;
  unsubscribed: number;
  /** null when the plan has no cap. */
  max_followers: number | null;
  followers_enabled: boolean;
  can_export: boolean;
}

interface FollowerPage {
  items: Follower[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export const PAGE_SIZE = 25;

export const useFollowerSummary = () => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  return useQuery<FollowerSummary>({
    queryKey: ['followerSummary', blogId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/followers/summary`)).data,
    enabled: !!blogId,
  });
};

export const useFollowers = (status: FollowerStatus | 'all', q: string, page: number) => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  return useQuery<FollowerPage>({
    queryKey: ['followers', blogId, status, q, page],
    queryFn: async () =>
      (await api.get(`/blogs/${blogId}/followers`, {
        params: {
          status: status === 'all' ? undefined : status,
          q: q || undefined,
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
      })).data,
    enabled: !!blogId,
    placeholderData: (previous) => previous,
  });
};

export const useAudienceActions = () => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['followers', blogId] });
    queryClient.invalidateQueries({ queryKey: ['followerSummary', blogId] });
  };

  const remove = useMutation({
    mutationFn: async (followerId: number) => api.delete(`/blogs/${blogId}/followers/${followerId}`),
    onSuccess: () => {
      refresh();
      toast.success('Follower removed.');
    },
    onError: (error) => toastApiError(error, "Couldn't remove the follower."),
  });

  const setEnabled = useMutation({
    mutationFn: async (enabled: boolean) =>
      api.patch(`/blogs/${blogId}/followers/settings`, { followers_enabled: enabled }),
    onSuccess: (_res, enabled) => {
      refresh();
      toast.success(enabled ? 'Follow form turned on.' : 'Follow form turned off.');
    },
    onError: (error) => toastApiError(error, "Couldn't change the follow form."),
  });

  const exportCsv = useMutation({
    mutationFn: async (status: FollowerStatus | 'all') => {
      const res = await api.get(`/blogs/${blogId}/followers/export`, {
        params: { status: status === 'all' ? undefined : status },
        responseType: 'blob',
      });
      const disposition = String(res.headers['content-disposition'] ?? '');
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'followers.csv';
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
    onError: (error) => toastApiError(error, "Couldn't export followers."),
  });

  return { remove, setEnabled, exportCsv };
};
