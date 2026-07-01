import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileText,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { useBlog } from '../../../app/providers/BlogProvider';
import { formatLocalDateTime } from '../../../shared/utils/dates';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  user: { username: string };
  post: { id: number; title: string };
  is_deleted: boolean;
}

export const CommentManager = () => {
  const { activeMembership } = useBlog();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [targetComment, setTargetComment] = useState<Comment | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ['blogComments', activeMembership?.blog_id],
    queryFn: async () => (await api.get('/comments')).data,
    enabled: !!activeMembership,
  });

  const groupedComments = useMemo(() => {
    if (!comments) return {};

    return comments.reduce((acc, comment) => {
      const title = comment.post?.title || 'Unknown Post';
      if (!acc[title]) acc[title] = [];
      acc[title].push(comment);
      return acc;
    }, {} as Record<string, Comment[]>);
  }, [comments]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const moderateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogComments', activeMembership?.blog_id] });
      toast.success('Comment redacted');
      setTargetComment(null);
    },
    onError: () => toast.error('Moderation failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="admin-card overflow-hidden rounded-[1.5rem]">
            {/* Group Header Skeleton */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-5 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-6 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>

            {/* Comments Skeleton */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="space-y-1">
                        <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-3 w-32 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                      </div>
                    </div>
                    <div className="h-20 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800/50" />
                  </div>
                  <div className="sm:mt-11">
                    <div className="h-8 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedComments).map(([postTitle, postComments]) => {
        const hasUnmoderated = postComments.some(c => !c.is_deleted);
        
        return (
          <div key={postTitle} className="admin-card overflow-hidden rounded-[1.5rem]">
            <div
              onClick={() => toggleGroup(postTitle)}
              className="flex cursor-pointer items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-6 py-4 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                {collapsedGroups[postTitle] ? (
                  <ChevronRight size={18} className="text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-zinc-400 flex-shrink-0" />
                )}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                  <FileText size={16} className="text-zinc-500" />
                </div>
                <h2 className="font-bold text-zinc-900 dark:text-white truncate">{postTitle}</h2>
                {hasUnmoderated && (
                  <span className="flex h-2 w-2 rounded-full bg-violet-500 shrink-0" title="Has unmoderated comments" />
                )}
              </div>

              <div className="flex items-center gap-4 shrink-0 pl-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <MessageSquare size={12} />
                  {postComments.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/posts/view/${postComments[0].post.id}`);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white hover:text-violet-600 hover:shadow-sm dark:hover:bg-zinc-800 dark:hover:text-violet-400"
                  title="View post"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>

            {!collapsedGroups[postTitle] && (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {postComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 transition-colors ${
                      comment.is_deleted
                        ? 'bg-zinc-50/50 dark:bg-zinc-900/30'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 text-sm font-bold text-violet-700 dark:from-violet-900/40 dark:to-fuchsia-900/40 dark:text-violet-300">
                          {comment.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white">{comment.user.username}</span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                            <Clock size={10} /> {formatLocalDateTime(comment.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className={`relative rounded-2xl p-4 text-sm ${
                        comment.is_deleted 
                          ? 'bg-zinc-100 text-zinc-500 italic border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400' 
                          : 'bg-white text-zinc-700 border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300'
                      }`}>
                        {/* Little chat bubble pointer */}
                        <div className={`absolute -top-2 left-4 h-4 w-4 rotate-45 border-l border-t ${
                          comment.is_deleted
                            ? 'bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'
                            : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
                        }`} />
                        <p className="relative z-10 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 sm:mt-11">
                      {!comment.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => setTargetComment(comment)}
                          aria-label={`Moderate comment from ${comment.user.username}`}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
                        >
                          <ShieldAlert size={14} /> Moderate
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                          Redacted
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {Object.keys(groupedComments).length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 py-24 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <MessageSquare size={32} className="text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Moderation Queue Clear</h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              There are no comments on any of your posts yet. When readers engage with your content, their comments will appear here.
            </p>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!targetComment}
        onClose={() => setTargetComment(null)}
        onConfirm={() => targetComment && moderateMutation.mutate(targetComment.id)}
        title="Redact Comment"
        message={`Are you sure you want to redact this comment by ${targetComment?.user.username}? This action will permanently mask the content to maintain the thread's integrity, but keep the comment record.`}
      />
    </div>
  );
};