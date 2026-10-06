import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../api/blogApi';
import type { Post, PaginatedPosts } from '../types/post';

const PAGE_SIZE = 12;

/**
 * True page-based pagination — each page replaces the last rather than
 * accumulating, so every listing page pages the same way.
 * Keeps the previous page's data visible while the next page loads, so
 * paging doesn't flash a full loading state on every click.
 */
export function usePagedPosts(
  queryKey: unknown[],
  endpoint: string,
  params: Record<string, string | undefined>,
  page: number,
  enabled: boolean = true,
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
    enabled,
  });

  const posts: Post[] = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { ...query, posts, total, totalPages, pageSize: PAGE_SIZE };
}

/** `?page=` as the source of truth for the current page, so paged listings are linkable. */
export function usePageParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { page, setPage };
}
