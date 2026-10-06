import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';

interface BlogStats {
  articles: number;
  projects: number;
  views: number;
}

/**
 * Blog-wide totals from the server. `hasProjects` gates the Projects toggle,
 * so blogs that never publish projects don't show an always-empty tab; it's
 * `undefined` until the stats load, so callers can avoid flickering the toggle.
 */
export const useBlogStats = () => {
  const { data } = useQuery<BlogStats>({
    queryKey: ['posts', 'stats'],
    queryFn: async () => (await api.get('/posts/stats')).data,
    staleTime: 5 * 60 * 1000,
  });

  return {
    stats: data,
    hasProjects: data ? data.projects > 0 : undefined,
  };
};
