import React, { useState } from 'react';
import api from '../api/blogApi';
import { getApiErrorMessage } from '../api/errors';
import toast from 'react-hot-toast';
import { Link, useLocation } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, X, Check, MoreVertical, Flag, CornerDownRight } from 'lucide-react';
import { formatLocalDate } from '../utils/dates';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import type { Comment, CommentReply, CommentThreadPage } from '../types/post';

const PAGE_SIZE = 20;
// Mirrors MAX_COMMENT_LENGTH in backend/app/schemas/comments.py.
const MAX_LENGTH = 5000;
// Longer reply lists start collapsed to this many.
const VISIBLE_REPLIES = 3;

const REPORT_REASONS = ['Spam', 'Harassment or bullying', 'Hate speech', 'Misinformation', 'Other'];

/** Textarea + character counter + submit, shared by new comments, replies and edits. */
const CommentForm: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  isPending: boolean;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
}> = ({ id, label, value, onChange, onSubmit, onCancel, submitLabel, isPending, rows = 4, placeholder, autoFocus }) => {
  const tooLong = value.length > MAX_LENGTH;
  const nearLimit = value.length > MAX_LENGTH * 0.9;

  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        className="w-full p-4 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:border-primary focus:bg-white outline-none transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:focus:bg-zinc-800"
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        aria-describedby={`${id}-count`}
      />
      <div className="mt-2 mb-3 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={isPending || !value.trim() || tooLong}
            className="btn-primary"
          >
            <Check size={16} />
            {isPending ? 'Saving…' : submitLabel}
          </button>
          {onCancel && (
            <button onClick={onCancel} disabled={isPending} className="btn-ghost">
              <X size={16} />
              Cancel
            </button>
          )}
        </div>
        <span
          id={`${id}-count`}
          className={`text-xs tabular-nums ${tooLong ? 'font-bold text-red-600 dark:text-red-400' : nearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`}
        >
          {value.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

/** Inline reason picker for reporting someone else's comment. */
const ReportPanel: React.FC<{ commentId: number; onDone: () => void }> = ({ commentId, onDone }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [notes, setNotes] = useState('');

  const report = useMutation({
    mutationFn: () => api.post(`/comments/${commentId}/flag`, { reason, notes: notes.trim() || null }),
    onSuccess: () => {
      toast.success('Thanks — our moderators will take a look.');
      onDone();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to send report')),
  });

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">Why are you reporting this?</legend>
        <div className="space-y-1.5">
          {REPORT_REASONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="radio"
                name={`report-reason-${commentId}`}
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                className="accent-primary"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`report-notes-${commentId}`} className="sr-only">Details (optional)</label>
      <textarea
        id={`report-notes-${commentId}`}
        className="mt-3 w-full p-3 bg-white rounded-xl border-2 border-zinc-300 outline-none focus:border-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        placeholder="Anything else moderators should know? (optional)"
        rows={2}
        maxLength={500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <button onClick={() => report.mutate()} disabled={report.isPending} className="btn-primary">
          <Flag size={16} />
          {report.isPending ? 'Sending…' : 'Send report'}
        </button>
        <button onClick={onDone} disabled={report.isPending} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
};

interface CommentItemProps {
  comment: Comment | CommentReply;
  postId: number;
  currentUserId?: number;
  isLoggedIn: boolean;
  canReply: boolean;
  onChanged: () => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, postId, currentUserId, isLoggedIn, canReply, onChanged }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reporting, setReporting] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);

  const isAuthor = comment.user?.id === currentUserId;
  const isDeleted = comment.is_deleted;
  const replies = 'replies' in comment ? comment.replies : [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, VISIBLE_REPLIES);
  const hiddenReplyCount = replies.length - visibleReplies.length;

  const saveEdit = useMutation({
    mutationFn: () => api.patch(`/comments/${comment.id}`, { content: editText }),
    onSuccess: () => {
      toast.success('Comment updated!');
      setEditing(false);
      onChanged();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update comment')),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/comments/${comment.id}`),
    onSuccess: () => {
      toast.success('Comment deleted');
      onChanged();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete comment')),
  });

  const postReply = useMutation({
    mutationFn: () => api.post('/comments/', { content: replyText, post_id: postId, parent_id: comment.id }),
    onSuccess: () => {
      toast.success('Reply posted!');
      setReplyText('');
      setReplying(false);
      setShowAllReplies(true);
      onChanged();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to post reply')),
  });

  const confirmDelete = () => {
    setMenuOpen(false);
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Delete this comment?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 rounded-lg text-sm font-bold text-zinc-600 hover:bg-zinc-100 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              remove.mutate();
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const hasMenu = isLoggedIn && !isDeleted && !editing;

  return (
    <div id={`comment-${comment.id}`}>
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="h-10 w-10 bg-zinc-900 rounded-full flex items-center justify-center font-bold text-white">
            {comment.user?.username ? comment.user.username[0].toUpperCase() : '?'}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-bold text-zinc-900 dark:text-zinc-50">
                {comment.user?.first_name || 'Anonymous'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatLocalDate(comment.created_at)}
                {comment.edited_at && !isDeleted && <span title={formatLocalDate(comment.edited_at)}> · edited</span>}
              </p>
            </div>

            {hasMenu && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                  aria-label="More options"
                  aria-expanded={menuOpen}
                >
                  <MoreVertical size={18} className="text-zinc-400" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-lg border border-zinc-200 py-2 w-40 dark:bg-zinc-900 dark:border-zinc-800">
                      {isAuthor ? (
                        <>
                          <button
                            onClick={() => {
                              setEditText(comment.content);
                              setEditing(true);
                              setMenuOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-all dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            <Edit2 size={16} className="text-zinc-900 dark:text-zinc-100" />
                            Edit
                          </button>
                          <button
                            onClick={confirmDelete}
                            className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-all dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setReporting(true);
                            setMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-all dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <Flag size={16} />
                          Report
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-3">
              <CommentForm
                id={`edit-${comment.id}`}
                label="Edit your comment"
                value={editText}
                onChange={setEditText}
                onSubmit={() => saveEdit.mutate()}
                onCancel={() => setEditing(false)}
                submitLabel="Save"
                isPending={saveEdit.isPending}
                rows={3}
                autoFocus
              />
            </div>
          ) : (
            <p className={`mt-2 leading-relaxed whitespace-pre-wrap break-words ${
              isDeleted ? 'italic text-zinc-500 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'
            }`}>
              {comment.content}
            </p>
          )}

          {canReply && !isDeleted && !editing && !replying && (
            <button
              onClick={() => setReplying(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-zinc-500 hover:text-primary transition-colors dark:text-zinc-400"
            >
              <CornerDownRight size={14} />
              Reply
            </button>
          )}

          {replying && (
            <div className="mt-4">
              <CommentForm
                id={`reply-${comment.id}`}
                label={`Reply to ${comment.user?.first_name || 'this comment'}`}
                value={replyText}
                onChange={setReplyText}
                onSubmit={() => postReply.mutate()}
                onCancel={() => setReplying(false)}
                submitLabel="Reply"
                isPending={postReply.isPending}
                rows={3}
                placeholder={`Reply to ${comment.user?.first_name || 'this comment'}…`}
                autoFocus
              />
            </div>
          )}

          {reporting && <ReportPanel commentId={comment.id} onDone={() => setReporting(false)} />}

          {replies.length > 0 && (
            <div className="mt-5 space-y-5 border-l-2 border-zinc-100 pl-5 dark:border-zinc-800">
              {visibleReplies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  isLoggedIn={isLoggedIn}
                  canReply={false}
                  onChanged={onChanged}
                />
              ))}
              {hiddenReplyCount > 0 && (
                <button
                  onClick={() => setShowAllReplies(true)}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Show {hiddenReplyCount} more {hiddenReplyCount === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Comments: React.FC<{ postId: number }> = ({ postId }) => {
  const location = useLocation();
  // A draft carried through the sign-in redirect (see the Sign in link below).
  const [text, setText] = useState(() => {
    const draft = (location.state as { draft?: unknown } | null)?.draft;
    return typeof draft === 'string' ? draft : '';
  });

  const { isAuthenticated: isLoggedIn, user } = useAuth();
  const currentUserId = user?.id;

  const { blog } = useTenant();
  const commentsEnabled = blog?.comments_enabled ?? true;

  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: async ({ pageParam }) =>
      (await api.get<CommentThreadPage>(`/comments/post/${postId}`, {
        params: { skip: pageParam, limit: PAGE_SIZE },
      })).data,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.skip + lastPage.limit : undefined),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    queryClient.invalidateQueries({ queryKey: ['post'] });
  };

  const postComment = useMutation({
    mutationFn: () => api.post('/comments/', { content: text, post_id: postId }),
    onSuccess: () => {
      setText('');
      toast.success('Comment posted!');
      refresh();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to post comment')),
  });

  const displayComments = data?.pages.flatMap((page) => page.items) ?? [];
  // From the newest page, so it reflects comments posted since the first load.
  const commentCount = data?.pages[data.pages.length - 1]?.comment_count ?? 0;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">
        Comments ({commentCount})
      </h2>

      {/* Comment Input */}
      {!commentsEnabled ? (
        <div className="p-8 bg-zinc-50 rounded-2xl text-center mb-10 border border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">Comments are disabled for this blog.</p>
        </div>
      ) : isLoggedIn ? (
        <div className="mb-10">
          <CommentForm
            id="comment-text"
            label="Your comment"
            value={text}
            onChange={setText}
            onSubmit={() => postComment.mutate()}
            onCancel={text ? () => setText('') : undefined}
            submitLabel="Post comment"
            isPending={postComment.isPending}
            placeholder="Write a thoughtful response..."
          />
        </div>
      ) : (
        <div className="p-8 bg-zinc-50 rounded-2xl text-center mb-10 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-zinc-900 dark:text-zinc-50 font-bold mb-2">Join the conversation</p>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Sign in to leave a comment</p>
          <Link
            to="/auth"
            state={{ from: location.pathname + location.search, draft: text }}
            className="btn-primary"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {isLoading ? null : displayComments.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 rounded-2xl dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          displayComments.map((comment: Comment) => (
            <div
              key={comment.id}
              className={`p-6 rounded-2xl border transition-all ${
                comment.is_deleted
                  ? 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
                  : 'bg-white border-zinc-100 hover:border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700'
              }`}
            >
              <CommentItem
                comment={comment}
                postId={postId}
                currentUserId={currentUserId}
                isLoggedIn={isLoggedIn}
                canReply={isLoggedIn && commentsEnabled}
                onChanged={refresh}
              />
            </div>
          ))
        )}
      </div>

      {hasNextPage && (
        <div className="mt-8 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="btn-ghost"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more comments'}
          </button>
        </div>
      )}
    </div>
  );
};
