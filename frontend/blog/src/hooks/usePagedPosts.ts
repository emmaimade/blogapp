import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../api/blogApi';
import type { Post, PaginatedPosts } from '../types/post';

const PAGE_SIZE = 12;

/**
 * True page-based pagination — each page replaces the last rather than
 * accumulating (unlike usePaginatedPosts' infinite-scroll "Load More").
 * Keeps the previous page's data visible while the next page loads, so
 * paging doesn't flash a full loading state on every click.
 */
export function usePagedPosts(
  queryKey: unknown[],
  endpoint: string,
  params: Record<string, string | undefined>,
  page: number,
) {
  const query = useQuery<PaginatedPosts>({
    queryKey: [...queryKey, page],
    queryFn: async () => {
      const res = await api.get<PaginatedPosts>(endpoint, {
        params: { ...params, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const posts: Post[] = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { ...query, posts, total, totalPages, pageSize: PAGE_SIZE };
}
