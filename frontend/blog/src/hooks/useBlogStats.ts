import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';

interface BlogStats {
  articles: number;
  views: number;
}

/** Blog-wide totals from the server, for the About page. */
export const useBlogStats = () => {
  const { data } = useQuery<BlogStats>({
    queryKey: ['posts', 'stats'],
    queryFn: async () => (await api.get('/posts/stats')).data,
    staleTime: 5 * 60 * 1000,
  });

  return { stats: data };
};
