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
  FileText 
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
  
  // Track which post groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ['adminComments'],
    queryFn: async () => (await api.get('/admin/comments')).data
  });

  // Group comments by post title using useMemo for performance
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
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const moderateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminComments'] });
      toast.success('Comment redacted');
      setTargetComment(null);
    },
    onError: () => toast.error('Moderation failed')
  });

  if (isLoading) return <div className="p-20 text-center animate-pulse text-gray-500 text-lg">Organizing moderation queue...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShieldAlert className="text-indigo-600" size={32} /> 
          Moderation Studio
        </h1>
        <p className="text-gray-500 mt-2">Manage discussions organized by post. Redacted comments are preserved to maintain thread structure.</p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedComments).map(([postTitle, postComments]) => (
          <div key={postTitle} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Group Header */}
            <div 
              onClick={() => toggleGroup(postTitle)}
              className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                {collapsedGroups[postTitle] ? <ChevronRight size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                <FileText size={20} className="text-indigo-500" />
                <h2 className="font-bold text-gray-800">{postTitle}</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {postComments.length} {postComments.length === 1 ? 'Comment' : 'Comments'}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/posts/view/${postComments[0].post.id}`);
                  }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-md transition"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>

            {/* Nested Comments List */}
            {!collapsedGroups[postTitle] && (
              <div className="divide-y divide-gray-50">
                {postComments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className={`p-6 flex justify-between items-start gap-6 transition-colors ${comment.is_deleted ? 'bg-gray-50/40' : 'hover:bg-gray-50/20'}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <User size={14} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{comment.user.username}</span>
                        <span className="text-xs text-gray-400">• {new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <p className={`text-gray-700 leading-relaxed ${comment.is_deleted ? 'italic text-gray-400' : ''}`}>
                        {comment.content}
                      </p>
                    </div>

                    <div className="flex items-center">
                      {!comment.is_deleted ? (
                        <button 
                          onClick={() => setTargetComment(comment)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={14} /> Moderate
                        </button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 border border-gray-200 px-2 py-1 rounded">
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
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <MessageSquare className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">No comments found to moderate.</p>
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