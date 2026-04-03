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
    onError: (_error, __, context) => {
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
      <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      <p className="animate-pulse text-slate-500 dark:text-slate-400">Loading content library...</p>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="admin-kicker">Content library</div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">Posts and project entries</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review content status, search titles, and move into edit or view flows without leaving the table.</p>
        </div>
        <button
          onClick={() => navigate("/admin/posts/new")}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={18} /> New Entry
        </button>
      </div>

      <div className="admin-section mb-6 p-4">
        <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <div className="flex w-full rounded-[1.2rem] bg-[var(--admin-primary-soft)] p-1.5 md:w-fit">
          {(["all", "published", "draft"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 rounded-[0.95rem] px-6 py-2.5 text-sm font-semibold capitalize transition-all md:flex-none ${
                filter === type ? "bg-[var(--admin-panel-solid)] text-slate-900 shadow-sm dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {type === "published" ? "Live" : type}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} />
          <input 
            type="text"
            placeholder="Search titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-[1.2rem] bg-[var(--admin-primary-soft)] px-10 py-2.5 text-sm font-semibold placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-slate-900"
          />

        </div>
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {filteredPosts?.map((post) => (
          <article key={post.id} className="admin-card space-y-4 rounded-[1.7rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => navigate(`/admin/posts/view/${post.id}`)}
                className="min-w-0 text-left font-bold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
              >
                <span className="line-clamp-2">{post.title}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
                  className="admin-icon-btn admin-icon-btn-edit"
                  aria-label={`Edit ${post.title}`}
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => setDeleteId(post.id)}
                  className="admin-icon-btn admin-icon-btn-delete"
                  aria-label={`Delete ${post.title}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {post.is_project ? (
                <span className="admin-badge bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <FolderOpen size={14} /> Project
                </span>
              ) : (
                <span className="admin-badge bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <FileText size={14} /> Blog
                </span>
              )}

              <button
                onClick={() => togglePublish.mutate(post)}
                className={`admin-badge transition-all ${
                  post.published ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                }`}
              >
                {post.published ? "Live" : "Draft"}
              </button>
            </div>

            <div className="rounded-2xl bg-[var(--admin-primary-soft)] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Timeline
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                <Calendar size={10} /> Updated {new Date(post.updated_at).toLocaleDateString()}
              </div>
            </div>
          </article>
        ))}

        {filteredPosts?.length === 0 && <div className="p-12 text-center italic text-stone-500">No posts found matching your current filter.</div>}
      </div>

      <div className="hidden md:block">
        <div className="admin-card admin-table-shell admin-scrollbar">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="admin-table-head text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-5">Title</th>
                <th className="p-5">Type</th>
                <th className="p-5">Visibility</th>
                <th className="p-5">Timeline</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(126,92,54,0.08)]">
              {filteredPosts?.map((post) => (
                <tr key={post.id} className="admin-table-row group transition-colors">
                  <td className="p-5">
                    <button
                      onClick={() => navigate(`/admin/posts/view/${post.id}`)}
                      className="text-left font-bold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                    >
                      {post.title}
                    </button>
                  </td>
                  <td className="p-5">
                    {post.is_project ? (
                      <span className="admin-badge bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        <FolderOpen size={14} /> Project
                      </span>
                    ) : (
                      <span className="admin-badge bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        <FileText size={14} /> Blog
                      </span>
                    )}
                  </td>
                  <td className="p-5">
                    <button
                      onClick={() => togglePublish.mutate(post)}
                      className={`admin-badge transition-all ${
                        post.published ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      }`}
                    >
                      {post.published ? "Live" : "Draft"}
                    </button>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">
                        {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                        <Calendar size={10} /> Updated {new Date(post.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex translate-x-2 justify-end gap-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
                      <button
                        onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
                        className="admin-icon-btn admin-icon-btn-edit"
                        aria-label={`Edit ${post.title}`}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => setDeleteId(post.id)}
                        className="admin-icon-btn admin-icon-btn-delete"
                        aria-label={`Delete ${post.title}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {filteredPosts?.length === 0 && <div className="p-20 text-center italic text-stone-500">No posts found matching your current filter.</div>}
        </div>
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
