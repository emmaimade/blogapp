import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import type { PaginatedPosts, Post } from '../types/post';

const SIDEBAR_POST_LIMIT = 5;
const SIDEBAR_TAG_LIMIT = 10;

/**
 * Blog-wide "Popular Posts" (by views) and "Popular Tags" (by post count),
 * ranked by the server — so every page's sidebar shows the same lists,
 * rather than each one ranking whatever slice of posts it happened to load.
 */
export const useSidebarData = (popularLimit: number = SIDEBAR_POST_LIMIT) => {
  const { data: popularData } = useQuery<PaginatedPosts>({
    queryKey: ['posts', 'sidebar-popular', popularLimit],
    queryFn: async () =>
      (await api.get('/posts/', { params: { sort: 'popular', limit: popularLimit } })).data,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tagsData } = useQuery<Array<{ name: string }>>({
    queryKey: ['tags', 'popular', SIDEBAR_TAG_LIMIT],
    queryFn: async () => (await api.get('/tags/popular', { params: { limit: SIDEBAR_TAG_LIMIT } })).data,
    staleTime: 5 * 60 * 1000,
  });

  const popularPosts: Post[] = popularData?.items ?? [];
  const tags: string[] = (tagsData ?? []).map((tag) => tag.name);

  return { popularPosts, tags };
};
