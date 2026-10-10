import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  ShieldAlert,
  Clock,
  Search,
  Flag,
  RotateCcw,
  Ban,
  UserCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useAuth } from '../../auth/context/AuthContext';
import { formatLocalDateTime } from '../../../shared/utils/dates';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const PAGE_SIZE = 25;

type StatusFilter = 'all' | 'active' | 'reported' | 'removed';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'reported', label: 'Reported' },
  { value: 'removed', label: 'Removed' },
];

const REMOVED_BY_LABEL: Record<string, string> = {
  author: 'Deleted by its author',
  moderator: 'Removed by a moderator',
  platform: 'Removed by platform moderators',
};

interface Comment {
  id: number;
  content: string;
  created_at: string;
  user: { id: number; username: string };
  post: { id: number; title: string };
  is_deleted: boolean;
  deleted_by: 'author' | 'moderator' | 'platform' | null;
  open_reports: number;
  can_restore: boolean;
}

interface CommentPage {
  items: Comment[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

interface CommentBan {
  user_id: number;
  user: { id: number; username: string };
  reason: string | null;
  created_at: string;
}

type PendingAction =
  | { kind: 'remove'; comment: Comment }
  | { kind: 'block'; comment: Comment };

// The API mirrors its message into `detail` for older clients.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiError = (err: any, fallback: string): string => err?.response?.data?.detail || fallback;

const secondaryButton =
  'flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';

export const CommentManager = () => {
  useDocumentTitle('Comments');
  const { activeMembership, activeRole } = useBlog();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const blogId = activeMembership?.blog_id;
  // Authors moderate comments on their own posts; blocking is blog-wide, so owner/editor only.
  const canBlock = activeRole === 'owner' || activeRole === 'editor';

  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [collapsedPosts, setCollapsedPosts] = useState<Record<number, boolean>>({});

  // Debounce the search box so each keystroke isn't a request.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery<CommentPage>({
    queryKey: ['blogComments', blogId, status, query, page],
    queryFn: async () =>
      (await api.get(`/blogs/${blogId}/comments/`, {
        params: { status, q: query || undefined, skip: page * PAGE_SIZE, limit: PAGE_SIZE },
      })).data,
    enabled: !!blogId,
    placeholderData: keepPreviousData,
  });

  const { data: bans } = useQuery<CommentBan[]>({
    queryKey: ['commentBans', blogId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/comments/bans`)).data,
    enabled: !!blogId && canBlock,
  });
  const blockedIds = useMemo(() => new Set((bans ?? []).map((b) => b.user_id)), [bans]);

  // Grouped by post id (not title — two posts can share a title), keeping
  // the newest-first order the API returns.
  const groups = useMemo(() => {
    const byPost = new Map<number, { post: Comment['post']; comments: Comment[] }>();
    for (const comment of data?.items ?? []) {
      const group = byPost.get(comment.post.id) ?? { post: comment.post, comments: [] };
      group.comments.push(comment);
      byPost.set(comment.post.id, group);
    }
    return [...byPost.values()];
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['blogComments', blogId] });
    queryClient.invalidateQueries({ queryKey: ['commentBans', blogId] });
  };

  const removeComment = useMutation({
    mutationFn: (id: number) => api.delete(`/blogs/${blogId}/comments/${id}`),
    onSuccess: () => {
      toast.success('Comment removed');
      refresh();
    },
    onError: (err) => toast.error(apiError(err, 'Could not remove the comment')),
  });

  const restoreComment = useMutation({
    mutationFn: (id: number) => api.post(`/blogs/${blogId}/comments/${id}/restore`),
    onSuccess: () => {
      toast.success('Comment restored');
      refresh();
    },
    onError: (err) => toast.error(apiError(err, 'Could not restore the comment')),
  });

  const blockUser = useMutation({
    mutationFn: (userId: number) => api.post(`/blogs/${blogId}/comments/bans`, { user_id: userId }),
    onSuccess: () => {
      toast.success('Blocked from commenting');
      refresh();
    },
    onError: (err) => toast.error(apiError(err, 'Could not block this person')),
  });

  const unblockUser = useMutation({
    mutationFn: (userId: number) => api.delete(`/blogs/${blogId}/comments/bans/${userId}`),
    onSuccess: () => {
      toast.success('Unblocked');
      refresh();
    },
    onError: (err) => toast.error(apiError(err, 'Could not unblock this person')),
  });

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === 'remove') removeComment.mutate(pending.comment.id);
    else blockUser.mutate(pending.comment.user.id);
    setPending(null);
  };

  const total = data?.total ?? 0;
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastShown = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter comments" className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                status === tab.value
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="relative block sm:w-72">
          <span className="sr-only">Search comments</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search comment text…"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="admin-card overflow-hidden rounded-[1.5rem]">
              <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-5 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="p-6">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="h-16 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800/50" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 py-24 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <MessageSquare size={32} className="text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {query || status !== 'all' ? 'No matching comments' : 'No comments yet'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              {query || status !== 'all'
                ? 'Try a different filter or search.'
                : 'When readers comment on your posts, their comments will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {groups.map(({ post, comments }) => {
            const collapsed = collapsedPosts[post.id];
            const reportedCount = comments.filter((c) => c.open_reports > 0).length;

            return (
              <div key={post.id} className="admin-card overflow-hidden rounded-[1.5rem]">
                <div
                  onClick={() => setCollapsedPosts((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  className="flex cursor-pointer items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-6 py-4 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {collapsed ? (
                      <ChevronRight size={18} className="flex-shrink-0 text-zinc-400" />
                    ) : (
                      <ChevronDown size={18} className="flex-shrink-0 text-zinc-400" />
                    )}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                      <FileText size={16} className="text-zinc-500" />
                    </div>
                    <h2 className="truncate font-bold text-zinc-900 dark:text-white">{post.title}</h2>
                    {reportedCount > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <Flag size={11} /> {reportedCount} reported
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-4 pl-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      <MessageSquare size={12} />
                      {comments.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/posts/view/${post.id}`);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white hover:text-violet-600 hover:shadow-sm dark:hover:bg-zinc-800 dark:hover:text-violet-400"
                      title="View post"
                      aria-label={`View post ${post.title}`}
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>

                {!collapsed && (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {comments.map((comment) => {
                      const isOwnComment = comment.user.id === user?.id;
                      const isBlocked = blockedIds.has(comment.user.id);

                      return (
                        <div
                          key={comment.id}
                          className={`flex flex-col justify-between gap-4 p-6 transition-colors sm:flex-row sm:items-start ${
                            comment.is_deleted ? 'bg-zinc-50/50 dark:bg-zinc-900/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 text-sm font-bold text-violet-700 dark:from-violet-900/40 dark:to-fuchsia-900/40 dark:text-violet-300">
                                {comment.user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                                  {comment.user.username}
                                  {isBlocked && (
                                    <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                                      Blocked
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                                  <Clock size={10} /> {formatLocalDateTime(comment.created_at)}
                                </span>
                              </div>
                              {comment.open_reports > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  <Flag size={11} /> Reported ×{comment.open_reports}
                                </span>
                              )}
                              {comment.is_deleted && (
                                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                  {REMOVED_BY_LABEL[comment.deleted_by ?? ''] ?? 'Removed'}
                                </span>
                              )}
                            </div>

                            <div
                              className={`rounded-2xl border p-4 text-sm ${
                                comment.is_deleted
                                  ? 'border-zinc-200 bg-zinc-100 italic text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                  : 'border-zinc-200 bg-white text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed">{comment.content}</p>
                              {comment.is_deleted && (
                                <p className="mt-2 text-xs not-italic text-zinc-400">
                                  Only your team sees this text — readers see a placeholder.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 sm:mt-11 sm:flex-col">
                            {!comment.is_deleted && (
                              <button
                                type="button"
                                onClick={() => setPending({ kind: 'remove', comment })}
                                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition-all hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
                              >
                                <ShieldAlert size={14} /> Remove
                              </button>
                            )}
                            {comment.can_restore && (
                              <button
                                type="button"
                                onClick={() => restoreComment.mutate(comment.id)}
                                disabled={restoreComment.isPending}
                                className={secondaryButton}
                              >
                                <RotateCcw size={14} /> Restore
                              </button>
                            )}
                            {canBlock && !isOwnComment && (
                              isBlocked ? (
                                <button
                                  type="button"
                                  onClick={() => unblockUser.mutate(comment.user.id)}
                                  disabled={unblockUser.isPending}
                                  className={secondaryButton}
                                >
                                  <UserCheck size={14} /> Unblock
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPending({ kind: 'block', comment })}
                                  className={secondaryButton}
                                >
                                  <Ban size={14} /> Block user
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {firstShown}–{lastShown} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.has_more}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Blocked commenters */}
      {canBlock && bans && bans.length > 0 && (
        <section className="admin-card rounded-[1.5rem] p-6">
          <h2 className="mb-1 font-bold text-zinc-900 dark:text-white">Blocked from commenting</h2>
          <p className="mb-4 text-sm text-zinc-500">These people can still read your blog, but can't comment or reply.</p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {bans.map((ban) => (
              <li key={ban.user_id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{ban.user.username}</p>
                  <p className="text-xs text-zinc-500">
                    Blocked {formatLocalDateTime(ban.created_at)}
                    {ban.reason ? ` · ${ban.reason}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => unblockUser.mutate(ban.user_id)}
                  disabled={unblockUser.isPending}
                  className={secondaryButton}
                >
                  <UserCheck size={14} /> Unblock
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        title={pending?.kind === 'block' ? 'Block from commenting' : 'Remove comment'}
        confirmText={pending?.kind === 'block' ? 'Block' : 'Remove'}
        message={
          pending?.kind === 'block'
            ? `Block ${pending.comment.user.username} from commenting on this blog? They can still read it, and their existing comments stay as they are. You can unblock them at any time.`
            : `Remove this comment by ${pending?.comment.user.username}? Readers will see a placeholder instead. Your team can still see the original text and restore it.`
        }
      />
    </div>
  );
};
