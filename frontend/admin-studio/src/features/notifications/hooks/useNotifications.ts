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
    queryFn: async () => (await api.get('/notifications/')).data,
    enabled: false, // fetched on demand when the dropdown opens
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