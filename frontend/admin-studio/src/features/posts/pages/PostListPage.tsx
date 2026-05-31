import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, FolderOpen, FileText, Plus, Search, Eye, Tag as TagIcon, Feather } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { type Post } from '../../../shared/types';

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
    <div className="space-y-6 animate-pulse">
      {/* Skeleton Header & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex w-full gap-2 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-zinc-900 md:w-fit border border-zinc-200 dark:border-zinc-800">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="h-9 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800 md:w-64" />
          <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Skeleton Desktop Table View */}
      <div className="hidden md:block">
        <div className="admin-card overflow-hidden">
          <div className="border-b border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex w-5/12 flex-col gap-2">
                  <div className="h-5 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  <div className="flex gap-2">
                    <div className="h-4 w-16 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                    <div className="h-4 w-24 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                  </div>
                </div>
                <div className="w-2/12">
                  <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="flex w-2/12 items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-4 w-24 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                </div>
                <div className="w-1/12 text-right">
                  <div className="ml-auto h-4 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="w-2/12 text-right">
                  <div className="ml-auto h-8 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skeleton Mobile View */}
      <div className="space-y-4 md:hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="admin-card space-y-4 rounded-[1.7rem] p-5">
            <div className="flex justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-1/2 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
              </div>
              <div className="h-8 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-6 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="h-12 w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/50" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ─── Header & Filters ─── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex w-full rounded-2xl bg-white p-1.5 shadow-sm dark:bg-zinc-900 md:w-fit border border-zinc-200 dark:border-zinc-800">
          {(["all", "published", "draft"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 rounded-xl px-5 py-2 text-sm font-semibold capitalize transition-all md:flex-none ${
                filter === type ? "bg-violet-100 text-violet-900 shadow-sm dark:bg-violet-900/40 dark:text-violet-100" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {type === "published" ? "Live" : type}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-9 py-2 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-violet-500"
            />
          </div>
          <button
            onClick={() => navigate("/admin/posts/new")}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 active:scale-95 transition-all"
          >
            <Plus size={16} /> New post
          </button>
        </div>
      </div>

      {/* ─── Mobile View ─── */}
      <div className="space-y-4 md:hidden">
        {filteredPosts?.map((post) => (
          <article key={post.id} className="admin-card space-y-4 rounded-[1.7rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <button
                  onClick={() => navigate(`/admin/posts/view/${post.id}`)}
                  className="min-w-0 text-left font-bold text-zinc-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-400 line-clamp-2"
                >
                  {post.title}
                </button>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="truncate">{post.author?.full_name || post.author?.username || 'Unknown'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Eye size={12} /> {post.views}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
                  className="admin-icon-btn admin-icon-btn-edit"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => setDeleteId(post.id)}
                  className="admin-icon-btn admin-icon-btn-delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  post.published ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                {post.published ? 'Live' : 'Draft'}
              </span>
              
              {post.is_project ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <FolderOpen size={12} /> Project
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <FileText size={12} /> Blog
                </span>
              )}
            </div>
            
            {post.tags && post.tags.length > 0 && (
               <div className="flex flex-wrap gap-1 mt-2">
                 {post.tags.map(t => (
                   <span key={t.id} className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                     {t.name}
                   </span>
                 ))}
               </div>
            )}

            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Timeline
              </div>
              <div className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Created: {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </article>
        ))}

        {filteredPosts?.length === 0 && (
           <div className="admin-card flex flex-col items-center gap-4 p-12 text-center">
             <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
               <Feather size={24} className="text-zinc-400" />
             </div>
             <div>
               <h3 className="font-bold text-zinc-900 dark:text-white">No posts found</h3>
               <p className="mt-1 text-sm text-zinc-500">Get started by creating a new post.</p>
             </div>
             <button
               onClick={() => navigate("/admin/posts/new")}
               className="mt-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
             >
               Write new post
             </button>
           </div>
        )}
      </div>

      {/* ─── Desktop Table View ─── */}
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
                {filteredPosts?.map((post) => (
                  <tr key={post.id} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="p-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => navigate(`/admin/posts/view/${post.id}`)}
                          className="text-left text-base font-bold text-zinc-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-400 line-clamp-1"
                        >
                          {post.title}
                        </button>
                        <div className="flex items-center gap-2">
                          {post.is_project ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              <FolderOpen size={10} /> Project
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              <FileText size={10} /> Blog
                            </span>
                          )}
                          <span className="text-xs text-zinc-400">•</span>
                          <span className="text-xs text-zinc-500">
                            {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {post.tags.slice(0, 3).map(t => (
                              <span key={t.id} className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                <TagIcon size={8} /> {t.name}
                              </span>
                            ))}
                            {post.tags.length > 3 && (
                              <span className="text-[10px] font-medium text-zinc-400">+{post.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                       <button
                        onClick={() => togglePublish.mutate(post)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-zinc-900 ${
                          post.published 
                            ? 'bg-emerald-100 text-emerald-800 hover:ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:ring-emerald-800' 
                            : 'bg-amber-100 text-amber-800 hover:ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:ring-amber-800'
                        }`}
                        title="Click to toggle status"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${post.published ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {post.published ? 'Live' : 'Draft'}
                      </button>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                          {(post.author?.full_name || post.author?.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {post.author?.full_name || post.author?.username || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right align-top">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        {post.views.toLocaleString()} <Eye size={14} className="text-zinc-400" />
                      </span>
                    </td>
                    <td className="p-4 text-right align-top">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
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
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredPosts?.length === 0 && (
             <div className="flex flex-col items-center gap-4 p-16 text-center bg-zinc-50/30 dark:bg-zinc-900/30">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                 <Feather size={24} className="text-zinc-400" />
               </div>
               <div>
                 <h3 className="font-bold text-zinc-900 dark:text-white">No posts found</h3>
                 <p className="mt-1 text-sm text-zinc-500">
                   {searchTerm ? 'Try adjusting your search or filters.' : 'Get started by creating your first post.'}
                 </p>
               </div>
               {!searchTerm && (
                 <button
                   onClick={() => navigate("/admin/posts/new")}
                   className="mt-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                 >
                   Write new post
                 </button>
               )}
             </div>
          )}
        </div>
      </div>

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
