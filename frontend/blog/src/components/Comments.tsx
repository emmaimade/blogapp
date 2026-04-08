import React, { useState, useEffect } from 'react';
import api from '../api/blogApi';
import toast from 'react-hot-toast';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, X, Check, MoreVertical } from 'lucide-react';

interface Comment {
  id: number;
  content: string;
  user: {
    id: number;
    username: string;
  };
  created_at: string;
  is_deleted?: boolean;
}

export const Comments: React.FC<{ postId: number, comments?: Comment[] }> = ({ postId, comments }) => {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  
  const isLoggedIn = !!localStorage.getItem('token');
  const currentUserId = Number(localStorage.getItem('userId'));
  
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
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to post comment');
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
      await api.patch(`/comments/${commentId}`, null, {
        params: { content: editText }
      });
      toast.success('Comment updated!');
      setEditingId(null);
      setEditText('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update comment');
    }
  };

  // Delete comment
  const deleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await api.delete(`/comments/${commentId}`);
      toast.success('Comment deleted');
      setMenuOpen(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete comment');
    }
  };

  const displayComments = fetchedComments || [];

  // Prefill draft if redirected from login
  useEffect(() => {
    const draft = (location.state as any)?.draft;
    if (draft && typeof draft === 'string' && !text) {
      setText(draft);
    }
  }, [location.state, text]);

  return (
    <div className="mt-12">
      <h3 className="text-2xl font-bold mb-6">
        Comments ({displayComments.length})
      </h3>

      {/* Comment Input */}
      {isLoggedIn ? (
        <div className="mb-10">
          <textarea
            className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none mb-4 transition-all"
            placeholder="Write a thoughtful response..."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-3">
            <button 
              onClick={postComment} 
              className="bg-indigo-600 text-white px-8 py-2.5 rounded-full font-bold hover:bg-indigo-700 transition-all"
            >
              Post Comment
            </button>
            {text && (
              <button 
                onClick={() => setText('')}
                className="px-6 py-2.5 text-slate-600 hover:text-slate-900 font-bold transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl text-center mb-10 border border-indigo-100">
          <p className="text-slate-900 font-bold mb-2">Join the conversation</p>
          <p className="text-slate-600 mb-4">Sign in to leave a comment</p>
          <Link
            to="/auth"
            state={{ from: location.pathname + location.search, draft: text }}
            className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-indigo-700 transition-all"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {displayComments.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl">
            <p className="text-slate-400 font-medium">No comments yet. Be the first to share your thoughts!</p>
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
                    ? 'bg-slate-50 border-slate-200' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-white">
                      {comment.user?.username ? comment.user.username[0].toUpperCase() : '?'}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-slate-900">
                          {comment.user?.username || 'Anonymous'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(comment.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>

                      {/* Actions Menu */}
                      {isAuthor && !isDeleted && !isEditing && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                            aria-label="More options"
                          >
                            <MoreVertical size={18} className="text-slate-400" />
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
                              <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-lg border border-slate-200 py-2 w-40">
                                <button
                                  onClick={() => startEdit(comment)}
                                  className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-all"
                                >
                                  <Edit2 size={16} className="text-indigo-600" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteComment(comment.id)}
                                  className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-all"
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
                          className="w-full p-3 bg-slate-50 rounded-xl border-2 border-indigo-500 outline-none mb-3"
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(comment.id)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all"
                          >
                            <Check size={16} />
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all"
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-slate-700 mt-2 leading-relaxed ${
                        isDeleted ? 'italic text-slate-400' : ''
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