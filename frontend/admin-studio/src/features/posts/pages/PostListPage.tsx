import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Edit, Trash2, FolderOpen, FileText, Plus, Search,
  Eye, Tag as TagIcon, Feather, Clock, ChevronLeft, ChevronRight, Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { type Post } from '../../../shared/types';
import { formatLocalDate, formatScheduled, formatShortDate } from '../../../shared/utils/dates';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { toastApiError } from '../../../shared/lib/apiErrors';

type FilterTab = 'all' | 'published' | 'scheduled' | 'draft';

const PAGE_SIZE = 20;

interface PaginatedPosts {
  items: Post[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

interface PostCounts {
  all: number;
  published: number;
  scheduled: number;
  draft: number;
}

// ── Date line ─────────────────────────────────────────────────────────────────
// Published posts show what readers see on the blog: the go-live date, plus
// "Updated" when the content was revised on a later day. Drafts show creation.
const describePostDate = (post: Post): string => {
  const isPublished = (post.status ?? (post.published ? 'published' : 'draft')) === 'published';
  if (!isPublished || !post.published_at) return `Created ${formatLocalDate(post.created_at)}`;

  const published = formatLocalDate(post.published_at);
  const edited = post.edited_at ? formatLocalDate(post.edited_at) : null;
  return edited && edited !== published
    ? `Published ${published} · Updated ${formatShortDate(post.edited_at)}`
    : `Published ${published}`;
};

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({
  status,
  publishedAt,
  interactive = false,
  onClick,
}: {
  status: string;
  publishedAt?: string | null;
  interactive?: boolean;
  onClick?: () => void;
}) => {
  const cfg = {
    published: {
      label: 'Live',
      dot: 'bg-emerald-500',
      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      ring: 'hover:ring-emerald-200 dark:hover:ring-emerald-800',
    },
    scheduled: {
      label: 'Scheduled',
      dot: 'bg-yellow-500',
      cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      ring: 'hover:ring-yellow-200 dark:hover:ring-yellow-800',
    },
    draft: {
      label: 'Draft',
      dot: 'bg-zinc-400',
      cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
      ring: 'hover:ring-zinc-200 dark:hover:ring-zinc-700',
    },
  }[status] ?? {
    label: status,
    dot: 'bg-zinc-400',
    cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    ring: '',
  };

  const Tag = interactive ? 'button' : 'span';

  return (
    <div className="space-y-1">
      <Tag
        onClick={onClick}
        title={interactive ? 'Click to toggle' : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${cfg.cls} ${interactive ? `cursor-pointer hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-zinc-900 ${cfg.ring}` : ''}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </Tag>
      {status === 'scheduled' && publishedAt && (
        <p className="text-[10px] text-yellow-700 dark:text-yellow-500 pl-1">
          {formatScheduled(publishedAt)}
        </p>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const PostList = () => {
  const toWorkspace = useWorkspacePath();
  useDocumentTitle('Posts');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeBlog } = useBlog();

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Any change to what's being viewed resets pagination to the first page.
  const viewKey = `${filter}|${debouncedSearch}|${activeBlog?.id}`;
  const [prevViewKey, setPrevViewKey] = useState(viewKey);
  if (viewKey !== prevViewKey) {
    setPrevViewKey(viewKey);
    setPage(1);
  }

  const postsQueryKey = ['adminPosts', activeBlog?.id, filter, debouncedSearch, page] as const;

  const { data, isLoading, isFetching } = useQuery<PaginatedPosts>({
    queryKey: postsQueryKey,
    queryFn: async () =>
      (await api.get(`/blogs/${activeBlog!.id}/posts`, {
        params: {
          status: filter === 'all' ? undefined : filter,
          q: debouncedSearch || undefined,
          skip: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
      })).data,
    enabled: !!activeBlog?.id,
    placeholderData: keepPreviousData,
  });

  const posts = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const { data: counts = { all: 0, published: 0, scheduled: 0, draft: 0 } } = useQuery<PostCounts>({
    queryKey: ['adminPostCounts', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/posts/counts`)).data,
    enabled: !!activeBlog?.id,
  });

  const invalidatePosts = () => {
    queryClient.invalidateQueries({ queryKey: ['adminPosts', activeBlog?.id] });
    queryClient.invalidateQueries({ queryKey: ['adminPostCounts', activeBlog?.id] });
  };

  // ── Toggle published/draft (not scheduled) ───────────────────────────────
  const togglePublish = useMutation({
    mutationFn: (post: Post) => {
      const newStatus = post.status === 'published' ? 'draft' : 'published';
      return api.patch(`/blogs/${activeBlog!.id}/posts/${post.id}`, { status: newStatus });
    },
    onMutate: async (updatedPost) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKey });
      const prev = queryClient.getQueryData<PaginatedPosts>(postsQueryKey);
      queryClient.setQueryData<PaginatedPosts | undefined>(postsQueryKey, (old) =>
        old && {
          ...old,
          items: old.items.map((p) =>
            p.id === updatedPost.id
              ? { ...p, status: p.status === 'published' ? 'draft' : 'published', published: p.status !== 'published' }
              : p
          ),
        }
      );
      return { prev };
    },
    onSuccess: () => toast.success('Status updated'),
    onError: (err, __, ctx) => {
      queryClient.setQueryData(postsQueryKey, ctx?.prev);
      toastApiError(err, 'Failed to update status');
    },
    onSettled: invalidatePosts,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/blogs/${activeBlog!.id}/posts/${id}`),
    onSuccess: () => {
      invalidatePosts();
      setDeleteId(null);
      toast.success('Post deleted');
    },
    onError: (error) => toastApiError(error, 'Could not delete post'),
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'published', label: 'Live' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'draft',     label: 'Drafts' },
  ];

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex w-full gap-2 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-zinc-900 md:w-fit border border-zinc-200 dark:border-zinc-800">
          {[...Array(4)].map((_, i) => <div key={i} className="h-9 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />)}
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="admin-card overflow-hidden">
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex w-5/12 flex-col gap-2">
                <div className="h-5 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-24 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
              </div>
              <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
              <div className="h-4 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-8 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ─── Toolbar ─── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Filter tabs */}
        <div className="flex w-full rounded-2xl bg-white p-1.5 shadow-sm dark:bg-zinc-900 md:w-fit border border-zinc-200 dark:border-zinc-800">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all md:flex-none ${
                filter === key
                  ? 'bg-violet-100 text-violet-900 shadow-sm dark:bg-violet-900/40 dark:text-violet-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === key ? 'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search posts…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-9 py-2 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => navigate(toWorkspace('/posts/new'))}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 active:scale-95 transition-all"
          >
            <Plus size={16} /> New post
          </button>
        </div>
      </div>

      {/* ─── Scheduled banner ─── */}
      {counts.scheduled > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3">
          <Clock size={15} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <strong>{counts.scheduled}</strong> post{counts.scheduled > 1 ? 's' : ''} scheduled to publish automatically.{' '}
            <button onClick={() => setFilter('scheduled')} className="underline font-semibold">View scheduled</button>
          </p>
        </div>
      )}

      {/* ─── Mobile View ─── */}
      <div className="space-y-4 md:hidden">
        {posts?.map((post) => (
          <article key={post.id} className="admin-card space-y-4 rounded-[1.7rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <button
                  onClick={() => navigate(toWorkspace(`/posts/view/${post.id}`))}
                  className="min-w-0 text-left font-bold text-zinc-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-400 line-clamp-2"
                >
                  {post.title}
                </button>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="truncate">{post.author?.username || 'Unknown'}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Eye size={12} /> {post.views}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => navigate(toWorkspace(`/posts/edit/${post.id}`))} className="admin-icon-btn admin-icon-btn-edit"><Edit size={16} /></button>
                <button onClick={() => setDeleteId(post.id)} className="admin-icon-btn admin-icon-btn-delete"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <StatusBadge status={post.status ?? (post.published ? 'published' : 'draft')} publishedAt={post.published_at} />
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {post.is_project ? <><FolderOpen size={12} /> Project</> : <><FileText size={12} /> Post</>}
              </span>
              {post.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <Star size={12} className="fill-amber-500 text-amber-500" /> Featured
                </span>
              )}
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.tags.map((t) => (
                  <span key={t.id} className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50 text-xs text-zinc-500">
              {post.status === 'scheduled' && post.published_at
                ? <span className="text-yellow-700 dark:text-yellow-400 font-semibold flex items-center gap-1"><Clock size={11} /> Publishes {formatScheduled(post.published_at)}</span>
                : <span>{describePostDate(post)}</span>
              }
            </div>
          </article>
        ))}

        {posts?.length === 0 && (
          <div className="admin-card flex flex-col items-center gap-4 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <Feather size={24} className="text-zinc-400" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white">No posts found</h3>
              <p className="mt-1 text-sm text-zinc-500">{searchTerm ? 'Try adjusting your search.' : 'Get started by writing your first post.'}</p>
            </div>
            {!searchTerm && (
              <button onClick={() => navigate(toWorkspace('/posts/new'))} className="mt-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                Write new post
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Desktop Table ─── */}
      <div className="hidden md:block">
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="p-4 w-5/12">Post</th>
                  <th className="p-4 w-2/12">Status</th>
                  <th className="p-4 w-2/12">Author</th>
                  <th className="p-4 w-1/12 text-right">Views</th>
                  <th className="p-4 w-2/12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {posts?.map((post) => {
                  const postStatus = post.status ?? (post.published ? 'published' : 'draft');
                  return (
                    <tr key={post.id} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      {/* Post title + meta */}
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => navigate(toWorkspace(`/posts/view/${post.id}`))}
                              className="text-left text-base font-bold text-zinc-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-400 line-clamp-1"
                            >
                              {post.title}
                            </button>
                            {post.is_featured && (
                              <Star size={14} className="shrink-0 fill-amber-500 text-amber-500" aria-label="Featured" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {post.is_project ? <><FolderOpen size={10} /> Project</> : <><FileText size={10} /> Post</>}
                            </span>
                            <span className="text-xs text-zinc-400">·</span>
                            <span className="text-xs text-zinc-500">
                              {postStatus === 'scheduled' && post.published_at
                                ? <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-500"><Clock size={10} /> {formatScheduled(post.published_at)}</span>
                                : describePostDate(post)
                              }
                            </span>
                          </div>
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {post.tags.slice(0, 3).map((t) => (
                                <span key={t.id} className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  <TagIcon size={8} /> {t.name}
                                </span>
                              ))}
                              {post.tags.length > 3 && <span className="text-[10px] text-zinc-400">+{post.tags.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status — only toggle for published/draft, not scheduled */}
                      <td className="p-4 align-top">
                        <StatusBadge
                          status={postStatus}
                          publishedAt={post.published_at}
                          interactive={postStatus !== 'scheduled'}
                          onClick={postStatus !== 'scheduled' ? () => togglePublish.mutate(post) : undefined}
                        />
                      </td>

                      {/* Author */}
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                            {(post.author?.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                            {post.author?.username || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* Views */}
                      <td className="p-4 text-right align-top">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {post.views.toLocaleString()} <Eye size={14} className="text-zinc-400" />
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right align-top">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            onClick={() => navigate(toWorkspace(`/posts/edit/${post.id}`))}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                            aria-label={`Edit ${post.title}`}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteId(post.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
                            aria-label={`Delete ${post.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {posts?.length === 0 && (
            <div className="flex flex-col items-center gap-4 p-16 text-center bg-zinc-50/30 dark:bg-zinc-900/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                <Feather size={24} className="text-zinc-400" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">No posts found</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {searchTerm ? 'Try adjusting your search or filters.' : 'Get started by writing your first post.'}
                </p>
              </div>
              {!searchTerm && (
                <button onClick={() => navigate(toWorkspace('/posts/new'))} className="mt-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">
                  Write new post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Pagination ─── */}
      {posts.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages}
            {isFetching && <span className="ml-2 text-zinc-400">Loading…</span>}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:disabled:hover:bg-zinc-900"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:disabled:hover:bg-zinc-900"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone and will permanently remove the post and all its comments."
      />
    </div>
  );
};