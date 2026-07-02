import { useQuery } from '@tanstack/react-query';
import { getPlatformStats, getBlogAnalytics } from '../api/superadminApi';
import { BarChart3, TrendingUp, Eye, FileText, Users, Building2, ArrowUp, Loader2 } from 'lucide-react';

export const SuperAdminAnalyticsPage = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: getPlatformStats,
  });

  const { data: blogs, isLoading: blogsLoading } = useQuery({
    queryKey: ['superadmin-blogs'],
    queryFn: getBlogAnalytics,
  });

  if (statsLoading || blogsLoading)  return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );;

  const topByViews = [...(blogs ?? [])].sort((a, b) => b.total_views - a.total_views).slice(0, 5);
  const topByPosts = [...(blogs ?? [])].sort((a, b) => b.total_posts - a.total_posts).slice(0, 5);
  const totalViews = blogs?.reduce((acc, b) => acc + b.total_views, 0) ?? 0;
  const totalPosts = blogs?.reduce((acc, b) => acc + b.total_posts, 0) ?? 0;

  const metricCards = [
    {
      label: 'Total Views',
      value: totalViews.toLocaleString(),
      sub: 'Across all workspaces',
      icon: Eye,
      color: 'text-primary',
      bg: 'bg-accent',
    },
    {
      label: 'Total Posts',
      value: totalPosts.toLocaleString(),
      sub: 'All published content',
      icon: FileText,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Active Blogs',
      value: (stats?.active_blogs ?? 0).toLocaleString(),
      sub: `of ${stats?.total_blogs ?? 0} total`,
      icon: Building2,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Total Users',
      value: (stats?.total_users ?? 0).toLocaleString(),
      sub: `${stats?.users_signed_up_today ?? 0} joined today`,
      icon: Users,
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-50',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Analytics</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Platform-wide performance metrics across all tenants.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
              <Icon size={20} className={color} />
            </div>
            <div className="text-3xl font-black text-zinc-900 dark:text-white">{value}</div>
            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-1">{label}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Today's Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-primary" />
            <h2 className="font-bold text-zinc-900 dark:text-white">Today's Activity</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'New blogs created', value: stats?.blogs_created_today ?? 0, positive: true },
              { label: 'New users signed up', value: stats?.users_signed_up_today ?? 0, positive: true },
            ].map(({ label, value, positive }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-700 last:border-0">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-zinc-900 dark:text-white">{value}</span>
                  {positive && value > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <ArrowUp size={10} /> New
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                      None
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={18} className="text-primary" />
            <h2 className="font-bold text-zinc-900 dark:text-white">Plan Distribution</h2>
          </div>
          {blogs && blogs.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(
                blogs.reduce((acc, b) => {
                  const plan = (b as any).plan ?? 'FREE';
                  acc[plan] = (acc[plan] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([plan, count]) => {
                const pct = Math.round((count / blogs.length) * 100);
                return (
                  <div key={plan}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{plan}</span>
                      <span className="text-zinc-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No blog data available.</p>
          )}
        </div>
      </div>

      {/* Top Performing Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top by Views */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
            <Eye size={16} className="text-primary" />
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm">Top Blogs by Views</h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {topByViews.map((blog, i) => (
              <div key={blog.blog_id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-zinc-400 w-4">{i + 1}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate max-w-[160px]">{blog.blog_name}</span>
                </div>
                <span className="text-sm font-bold text-primary">{blog.total_views.toLocaleString()}</span>
              </div>
            ))}
            {topByViews.length === 0 && <p className="px-5 py-4 text-sm text-zinc-500">No data yet.</p>}
          </div>
        </div>

        {/* Top by Posts */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm">Top Blogs by Posts</h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {topByPosts.map((blog, i) => (
              <div key={blog.blog_id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-zinc-400 w-4">{i + 1}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate max-w-[160px]">{blog.blog_name}</span>
                </div>
                <span className="text-sm font-bold text-primary">{blog.total_posts.toLocaleString()}</span>
              </div>
            ))}
            {topByPosts.length === 0 && <p className="px-5 py-4 text-sm text-zinc-500">No data yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
