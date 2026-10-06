import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getPlatformStats, getBlogAnalytics } from '../api/superadminApi';
import { Activity, Users, Database, Layout } from 'lucide-react';
import { SuperAdminDashboardSkeleton } from '../components/SuperAdminDashboardSkeleton';
import { formatSmart } from '../../../shared/utils/dates';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const TENANT_PREVIEW_LIMIT = 5;

export const SuperAdminDashboardPage = () => {
  useDocumentTitle('Platform overview');
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: getPlatformStats,
  });

  const { data: blogs, isLoading: blogsLoading } = useQuery({
    queryKey: ['superadmin-blogs'],
    queryFn: getBlogAnalytics,
  });

  if (statsLoading || blogsLoading) return <SuperAdminDashboardSkeleton />;

  const displayedBlogs = [...(blogs ?? [])]
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, TENANT_PREVIEW_LIMIT);
  const hasMoreBlogs = (blogs?.length ?? 0) > TENANT_PREVIEW_LIMIT;

  const recentSignups = [...(blogs ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, TENANT_PREVIEW_LIMIT);

  return (
    <div className="p-4 sm:p-8 max-w-full sm:max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Overview</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Global metrics across all tenants.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-4 text-zinc-800 mb-4"><Database size={24} /> <span className="font-semibold text-zinc-700 dark:text-zinc-300">Total Blogs</span></div>
          <div className="text-4xl font-bold text-zinc-900 dark:text-white">{stats?.total_blogs || 0}</div>
          <p className="text-sm text-zinc-500 mt-2">{stats?.active_blogs || 0} active</p>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-4 text-violet-500 mb-4"><Users size={24} /> <span className="font-semibold text-zinc-700 dark:text-zinc-300">Total Users</span></div>
          <div className="text-4xl font-bold text-zinc-900 dark:text-white">{stats?.total_users || 0}</div>
          <p className="text-sm text-zinc-500 mt-2">Platform wide</p>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-4 text-violet-400 mb-4"><Layout size={24} /> <span className="font-semibold text-zinc-700 dark:text-zinc-300">Total Posts</span></div>
          <div className="text-4xl font-bold text-zinc-900 dark:text-white">{stats?.total_posts || 0}</div>
          <p className="text-sm text-zinc-500 mt-2">Published content</p>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-4 text-zinc-900 mb-4"><Activity size={24} /> <span className="font-semibold text-zinc-700 dark:text-zinc-300">Total Views</span></div>
          <div className="text-4xl font-bold text-zinc-900 dark:text-white">{stats?.total_views || 0}</div>
          <p className="text-sm text-zinc-500 mt-2">Across all blogs</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Active Tenants</h2>
          {hasMoreBlogs && (
            <Link to="/admin/blogs" className="text-sm font-medium text-primary hover:underline shrink-0">
              View all
            </Link>
          )}
        </div>
        <div className="block md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
          {(!displayedBlogs || displayedBlogs.length === 0) ? (
            <div className="p-4 text-center text-zinc-500">No tenants active.</div>
          ) : (
            displayedBlogs.map((b) => (
              <div key={`mobile-b-${b.blog_id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-200 truncate">{b.blog_name}</div>
                  <div className="text-xs text-zinc-500">{b.total_posts} posts · {b.total_views} views</div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center rounded-full bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-950 dark:bg-zinc-900/50 dark:text-zinc-500">{b.plan}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 font-semibold text-zinc-900 dark:bg-zinc-800/50 dark:text-zinc-200">
              <tr>
                <th className="px-6 py-4">Blog Name</th>
                <th className="px-6 py-4">Total Posts</th>
                <th className="px-6 py-4">Total Views</th>
                <th className="px-6 py-4">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {displayedBlogs?.map((b) => (
                <tr key={b.blog_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-200">{b.blog_name}</td>
                  <td className="px-6 py-4">{b.total_posts}</td>
                  <td className="px-6 py-4">{b.total_views}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-950 dark:bg-zinc-900/50 dark:text-zinc-500">{b.plan}</span></td>
                </tr>
              ))}
              {(!displayedBlogs || displayedBlogs.length === 0) && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No tenants active.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mt-6">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Recent Signups</h2>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {recentSignups.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">No tenants yet.</div>
          ) : (
            recentSignups.map((b) => (
              <div key={`signup-${b.blog_id}`} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-200 truncate">{b.blog_name}</div>
                  <div className="text-xs text-zinc-500 truncate">{b.owner_email}</div>
                </div>
                <div className="shrink-0 text-xs text-zinc-500">{formatSmart(b.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
