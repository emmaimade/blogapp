import React, { useState, useEffect } from 'react';
import api from '../api/blogApi';
import { getApiErrorMessage } from '../api/errors';
import toast from 'react-hot-toast';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, X, Check, MoreVertical } from 'lucide-react';
import { formatLocalDate } from '../utils/dates';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import type { Comment } from '../types/post';

export const Comments: React.FC<{ postId: number, comments?: Comment[] }> = ({ postId, comments }) => {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const { isAuthenticated: isLoggedIn, user } = useAuth();
  const currentUserId = user?.id;

  const { blog } = useTenant();
  const commentsEnabled = blog?.comments_enabled ?? true;

  const queryClient = useQueryClient();
  const location = useLocation();

  const { data: fetchedComments } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => (await api.get(`/comments/post/${postId}`)).data,
    initialData: comments || [],
  });

  // Post new comment
  const postComment = async () => {
    if (!text.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    try {
      await api.post('/comments/', { content: text, post_id: postId });
      setText('');
      toast.success('Comment posted!');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to post comment'));
    }
  };

  // Start editing
  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.content);
    setMenuOpen(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // Save edited comment
  const saveEdit = async (commentId: number) => {
    if (!editText.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    try {
      await api.patch(`/comments/${commentId}`, { content: editText });
      toast.success('Comment updated!');
      setEditingId(null);
      setEditText('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update comment'));
    }
  };

  // Delete comment
  const performDelete = async (commentId: number) => {
    try {
      await api.delete(`/comments/${commentId}`);
      toast.success('Comment deleted');
      setMenuOpen(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete comment'));
    }
  };

  const deleteComment = (commentId: number) => {
    setMenuOpen(null);
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
              performDelete(commentId);
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const displayComments = fetchedComments || [];

  // Prefill draft if redirected from login
  useEffect(() => {
    const draft = (location.state as { draft?: unknown } | null)?.draft;
    if (draft && typeof draft === 'string' && !text) {
      setText(draft);
    }
  }, [location.state, text]);

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">
        Comments ({displayComments.length})
      </h2>

      {/* Comment Input */}
      {!commentsEnabled ? (
        <div className="p-8 bg-zinc-50 rounded-2xl text-center mb-10 border border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">Comments are disabled for this blog.</p>
        </div>
      ) : isLoggedIn ? (
        <div className="mb-10">
          <label htmlFor="comment-text" className="sr-only">Your comment</label>
          <textarea
            id="comment-text"
            className="w-full p-4 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:border-primary focus:bg-white outline-none mb-4 transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:focus:bg-zinc-800"
            placeholder="Write a thoughtful response..."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-3">
            <button onClick={postComment} className="btn-primary">
              Post comment
            </button>
            {text && (
              <button onClick={() => setText('')} className="btn-ghost">
                Cancel
              </button>
            )}
          </div>
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
        {displayComments.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 rounded-2xl dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          displayComments.map((comment: Comment) => {
            const isAuthor = comment.user?.id === currentUserId;
            const isEditing = editingId === comment.id;
            const isDeleted = comment.is_deleted || comment.content.includes('[This comment has been removed');

            return (
              <div
                key={comment.id}
                className={`p-6 rounded-2xl border transition-all ${
 isDeleted
 ? 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
 : 'bg-white border-zinc-100 hover:border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700'
 }`}
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-zinc-900 rounded-full flex items-center justify-center font-bold text-white">
                      {comment.user?.username ? comment.user.username[0].toUpperCase() : '?'}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-50">
                          {comment.user?.first_name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatLocalDate(comment.created_at)}
                        </p>
                      </div>

                      {/* Actions Menu */}
                      {isAuthor && !isDeleted && !isEditing && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                            aria-label="More options"
                          >
                            <MoreVertical size={18} className="text-zinc-400" />
                          </button>

                          {/* Dropdown Menu */}
                          {menuOpen === comment.id && (
                            <>
                              {/* Backdrop */}
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpen(null)}
                              />

                              {/* Menu */}
                              <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-lg border border-zinc-200 py-2 w-40 dark:bg-zinc-900 dark:border-zinc-800">
                                <button
                                  onClick={() => startEdit(comment)}
                                  className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-all dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  <Edit2 size={16} className="text-zinc-900 dark:text-zinc-100" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteComment(comment.id)}
                                  className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-all dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Comment Content or Edit Form */}
                    {isEditing ? (
                      <div className="mt-3">
                        <textarea
                          className="w-full p-3 bg-zinc-50 rounded-xl border-2 border-zinc-300 outline-none mb-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(comment.id)}
                            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary-hover transition-all"
                          >
                            <Check size={16} />
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-zinc-600 hover:bg-zinc-100 transition-all dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-zinc-700 dark:text-zinc-300 mt-2 leading-relaxed ${
 isDeleted ? 'italic text-zinc-500 dark:text-zinc-500' : ''
 }`}>
                        {comment.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};