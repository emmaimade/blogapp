import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/api/client';

export interface AppNotification {
  id: number;
  blog_id: number | null;
  type: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const { data: unreadCount } = useQuery<number>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data.count,
    refetchInterval: 45000,
  });

  const { data: notifications, refetch } = useQuery<AppNotification[]>({
    queryKey: ['notifications-list'],
    // Guarded because a misrouted request can come back as HTML with a 200
    // (the SPA fallback) - a string here made the dropdown's .map() throw.
    queryFn: async () => {
      const { data } = await api.get('/notifications/');
      return Array.isArray(data) ? data : [];
    },
    // Fetched proactively so the list is already warm by the time someone
    // opens the bell - opening it then just reveals cached data instantly,
    // with refetch() below still called on open to refresh it in the
    // background. Previously this was `enabled: false` ("fetch on open"),
    // which made every open a cold network round-trip with nothing to show
    // until it resolved.
    staleTime: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  return { unreadCount: unreadCount ?? 0, notifications, refetch, markReadMutation, markAllReadMutation };
};