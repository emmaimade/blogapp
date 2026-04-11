import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
  MessageSquare,
  User,
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { Modal } from '../components/Modal';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  user: { username: string };
  post: { id: number; title: string };
  is_deleted: boolean;
}

export const CommentManager = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [targetComment, setTargetComment] = useState<Comment | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ['adminComments'],
    queryFn: async () => (await api.get('/admin/comments')).data,
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
      queryClient.invalidateQueries({ queryKey: ['adminComments'] });
      toast.success('Comment redacted');
      setTargetComment(null);
    },
    onError: () => toast.error('Moderation failed'),
  });

  if (isLoading) {
    return <div className="p-20 text-center text-lg text-slate-500 animate-pulse">Organizing moderation queue...</div>;
  }

  return (
    <div className="admin-page max-w-6xl">
      <div className="space-y-6">
        {Object.entries(groupedComments).map(([postTitle, postComments]) => (
          <div key={postTitle} className="admin-card overflow-hidden rounded-[1.8rem]">
            <div
              onClick={() => toggleGroup(postTitle)}
              className="flex cursor-pointer items-center justify-between border-b border-[var(--admin-line)] bg-[color:var(--admin-primary-soft)]/70 px-6 py-4 transition-colors hover:bg-[color:var(--admin-primary-soft)]"
            >
              <div className="flex items-center gap-3">
                {collapsedGroups[postTitle] ? (
                  <ChevronRight size={20} className="text-slate-400" />
                ) : (
                  <ChevronDown size={20} className="text-slate-400" />
                )}
                <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-bold text-slate-900 dark:text-white">{postTitle}</h2>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  {postComments.length} {postComments.length === 1 ? 'Comment' : 'Comments'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/posts/view/${postComments[0].post.id}`);
                  }}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-indigo-700 dark:hover:bg-slate-900 dark:hover:text-indigo-300"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>

            {!collapsedGroups[postTitle] && (
              <div className="divide-y divide-[rgba(126,92,54,0.08)]">
                {postComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`flex items-start justify-between gap-6 p-6 transition-colors ${
                      comment.is_deleted
                        ? 'bg-slate-100/50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-400'
                        : 'hover:bg-indigo-50/30 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <User size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{comment.user.username}</span>
                        <span className="text-xs text-slate-400">• {new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>

                      <p
                        className={`leading-relaxed text-slate-700 dark:text-slate-300 ${
                          comment.is_deleted ? 'italic text-slate-400 dark:text-slate-500' : ''
                        }`}
                      >
                        {comment.content}
                      </p>
                    </div>

                    <div className="flex items-center">
                      {!comment.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => setTargetComment(comment)}
                          aria-label={`Moderate comment from ${comment.user.username}`}
                          className="admin-btn inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition-all duration-150 ease-out hover:bg-red-100 hover:text-red-800 hover:shadow-md dark:border-red-600 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                        >
                          <Trash2 size={14} /> Moderate
                        </button>
                      ) : (
                        <span className="rounded-full border border-stone-200 px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-stone-300 dark:border-slate-700 dark:text-slate-500">
                          Redacted
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {Object.keys(groupedComments).length === 0 && (
          <div className="admin-section border-2 border-dashed bg-transparent py-20 text-center">
            <MessageSquare className="mx-auto mb-4 text-slate-300" size={48} />
            <p className="font-medium text-slate-500 dark:text-slate-400">No comments found to moderate.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!targetComment}
        onClose={() => setTargetComment(null)}
        onConfirm={() => targetComment && moderateMutation.mutate(targetComment.id)}
        title="Moderate Comment"
        message={`Are you sure you want to redact this comment by ${targetComment?.user.username}? This action will permanently mask the content to maintain the thread's integrity.`}
      />
    </div>
  );
};
