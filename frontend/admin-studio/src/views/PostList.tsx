import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, FolderOpen, FileText, Plus, Search, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { type Post } from '../types';
import { Modal } from '../components/Modal'; 

export const PostList = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ['adminPosts'],
    queryFn: async () => (await api.get('/posts/')).data
  });

  const togglePublish = useMutation({
    mutationFn: (post: Post) =>
      api.patch(`/posts/${post.id}`, { published: !post.published }),
    onMutate: async (updatedPost) => {
      await queryClient.cancelQueries({ queryKey: ["adminPosts"] });
      const previousPosts = queryClient.getQueryData(["adminPosts"]);
      queryClient.setQueryData(["adminPosts"], (old: Post[]) =>
        old.map((p) => p.id === updatedPost.id ? { ...p, published: !p.published } : p)
      );
      return { previousPosts };
    },
    onSuccess: () => toast.success('Visibility updated'),
    onError: (err, __, context) => {
      queryClient.setQueryData(["adminPosts"], context?.previousPosts);
      toast.error('Failed to update status');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["adminPosts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPosts"] });
      toast.success('Post permanently deleted');
    },
    onError: () => toast.error('Could not delete post')
  });

  const filteredPosts = posts?.filter(post => {
    const matchesFilter = filter === 'all' ? true : filter === 'published' ? post.published : !post.published;
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (isLoading) return (
    <div className="p-20 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-500 animate-pulse">Loading content library...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Library</h1>
          <p className="text-gray-500 text-sm">Review, edit, and manage your portfolio visibility.</p>
        </div>
        <button
          onClick={() => navigate("/admin/posts/new")}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
        >
          <Plus size={18} /> New Entry
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex p-1 bg-gray-100 rounded-xl w-full md:w-fit">
          {(["all", "published", "draft"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                filter === type ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {type === "published" ? "Live" : type}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs uppercase tracking-widest font-bold">
            <tr>
              <th className="p-5">Title</th>
              <th className="p-5">Type</th>
              <th className="p-5">Visibility</th>
              <th className="p-5">Timeline</th> {/* Updated Header */}
              <th className="p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredPosts?.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="p-5">
                  <button
                    onClick={() => navigate(`/admin/posts/view/${post.id}`)}
                    className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors text-left"
                  >
                    {post.title}
                  </button>
                </td>
                <td className="p-5">
                  {post.is_project ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                      <FolderOpen size={14} /> Project
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                      <FileText size={14} /> Blog
                    </span>
                  )}
                </td>
                <td className="p-5">
                  <button
                    onClick={() => togglePublish.mutate(post)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${
                      post.published ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    {post.published ? "Live" : "Draft"}
                  </button>
                </td>
                {/* New Date Cell */}
                <td className="p-5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-700">
                      {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                      <Calendar size={10} /> Updated {new Date(post.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="p-5 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button onClick={() => navigate(`/admin/posts/edit/${post.id}`)} className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit size={18} /></button>
                    <button onClick={() => setDeleteId(post.id)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPosts?.length === 0 && <div className="p-20 text-center text-gray-500 italic">No posts found matching your current filter.</div>}
      </div>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Confirm Deletion"
        message="Are you sure? This will permanently remove the post and its associated comments from the database."
      />
    </div>
  );
};