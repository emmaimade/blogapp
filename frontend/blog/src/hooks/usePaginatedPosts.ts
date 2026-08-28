import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import type { Post, PaginatedPosts } from '../types/post';

const PAGE_SIZE = 12;

export function usePaginatedPosts(
  queryKey: unknown[],
  endpoint: string,
  params: Record<string, string | undefined>,
  enabled: boolean = true,
) {
  const query = useInfiniteQuery<PaginatedPosts>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const res = await api.get<PaginatedPosts>(endpoint, {
        params: { ...params, skip: pageParam, limit: PAGE_SIZE },
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.skip + lastPage.limit : undefined),
    enabled,
  });

  const posts: Post[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return { ...query, posts, total };
}
