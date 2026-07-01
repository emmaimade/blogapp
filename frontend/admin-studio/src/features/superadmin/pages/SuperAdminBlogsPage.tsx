import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlogAnalytics } from '../api/superadminApi';
import { Building2, Search, MoreHorizontal, CheckCircle2, XCircle, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { formatLocalDate, formatLocalDateTime, formatSmart } from '../../../shared/utils/dates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const planBadge: Record<string, string> = {
  FREE:         'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  STARTER:      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PROFESSIONAL: 'bg-accent text-accent-text',
  ENTERPRISE:   'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

export const SuperAdminBlogsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const { data: blogs, isLoading } = useQuery({
    queryKey: ['superadmin-blogs'],
    queryFn: getBlogAnalytics,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      axios.patch(`${API_URL}/superadmin/blogs/${id}`, { is_active: active }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadmin-blogs'] }),
  });

  const deleteBlog = useMutation({
    mutationFn: (id: number) =>
      axios.delete(`${API_URL}/superadmin/blogs/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadmin-blogs'] }),
  });

  const filtered = (blogs ?? []).filter((b) =>
    b.blog_name.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Blogs</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Manage all tenant workspaces on the platform.</p>
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl font-semibold">
          {blogs?.length ?? 0} total
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search blogs or owners…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Blog</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Owner</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Plan</th>
                <th className="text-right px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Posts</th>
                <th className="text-right px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Views</th>
                <th className="text-right px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Members</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Created</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-zinc-500">
                    {search ? 'No blogs match your search.' : 'No blogs yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((blog) => {
                  const isActive = (blog as any).is_active !== false;
                  const plan = (blog as any).plan ?? 'FREE';
                  const createdAt = formatLocalDate(blog.created_at);
                  return (
                    <tr key={blog.blog_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                            <Building2 size={14} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-white">{blog.blog_name}</p>
                            <p className="text-xs text-zinc-500">ID: {blog.blog_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs">{blog.owner_email ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${planBadge[plan] ?? planBadge.FREE}`}>
                          {plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-900 dark:text-white">{blog.total_posts}</td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-900 dark:text-white">{blog.total_views.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-900 dark:text-white">{(blog as any).team_members ?? '—'}</td>
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-2.5 py-0.5 rounded-full">
                            <XCircle size={11} /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">{createdAt}</td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === blog.blog_id ? null : blog.blog_id)}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenu === blog.blog_id && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1">
                              <button
                                onClick={() => { toggleActive.mutate({ id: blog.blog_id, active: !isActive }); setOpenMenu(null); }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
                              >
                                {isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                {isActive ? 'Suspend' : 'Reactivate'}
                              </button>
                              <a
                                href={`https://${(blog as any).subdomain ?? blog.blog_id}.inko.blog`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
                              >
                                <ExternalLink size={14} /> View blog
                              </a>
                              <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${blog.blog_name}"? This cannot be undone.`)) {
                                    deleteBlog.mutate(blog.blog_id);
                                    setOpenMenu(null);
                                  }
                                }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};