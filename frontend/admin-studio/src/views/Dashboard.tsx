import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, BarChart3, FileText, MessageSquare, TrendingUp, Users, Plus, Eye, Edit3, CheckCircle, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Stats {
  posts: number;
  users: number;
  comments: number;
  tags?: number;
}

interface ViewsData {
  total: number;
  growth: string;
  trend: string;
}

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  time: string;
  icon: string;
}

interface WeeklyStats {
  posts: { count: number; change: string; positive: boolean };
  comments: { count: number; change: string; positive: boolean };
  views: { count: number; change: string; positive: boolean };
}

interface TrendsData {
  posts: { change: string; trend: string };
  users: { change: string; trend: string };
  comments: { change: string; trend: string };
}

const fetchStats = async (): Promise<Stats> => {
  const { data } = await api.get('/admin/stats');
  return data;
};

const fetchViews = async (): Promise<ViewsData> => {
  const { data } = await api.get('/admin/stats/views');
  return data;
};

const fetchActivity = async (): Promise<ActivityItem[]> => {
  const { data } = await api.get('/admin/stats/activity');
  return data;
};

const fetchWeekly = async (): Promise<WeeklyStats> => {
  const { data } = await api.get('/admin/stats/weekly');
  return data;
};

const fetchTrends = async (): Promise<TrendsData> => {
  const { data } = await api.get('/admin/stats/trends');
  return data;
};

export const Dashboard = () => {
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['adminStats'], 
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const { data: viewsData } = useQuery({
    queryKey: ['adminViews'],
    queryFn: fetchViews,
    refetchInterval: 30000,
  });

  const { data: activity } = useQuery({
    queryKey: ['adminActivity'],
    queryFn: fetchActivity,
    refetchInterval: 15000,
  });

  const { data: weeklyData } = useQuery({
    queryKey: ['adminWeekly'],
    queryFn: fetchWeekly,
    refetchInterval: 30000,
  });

  const { data: trendsData } = useQuery({
    queryKey: ['adminTrends'],
    queryFn: fetchTrends,
    refetchInterval: 60000,
  });

  // Helper: Format timestamp to "2 hours ago"
  const formatTime = (isoTime: string) => {
    try {
      return formatDistanceToNow(new Date(isoTime), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  // Helper: Get icon for activity type
  const getIconForType = (type: string) => {
    switch(type) {
      case 'post': return <FileText size={18} />;
      case 'comment': return <MessageSquare size={18} />;
      case 'user': return <Users size={18} />;
      default: return <Edit3 size={18} />;
    }
  };

  // Helper: Get color for activity type
  const getColorForType = (type: string): 'indigo' | 'purple' | 'pink' | 'slate' => {
    switch(type) {
      case 'post': return 'indigo';
      case 'comment': return 'purple';
      case 'user': return 'pink';
      default: return 'slate';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card p-8 text-center">
        <h3 className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load statistics</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          {error instanceof Error ? error.message : 'Please try again later'}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="admin-btn admin-btn-primary px-6 py-2.5"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ✅ Stats Grid First (Industry Standard - WordPress/Ghost) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Posts"
          value={data?.posts || 0}
          change={trendsData?.posts?.change || "+0%"}
          trend={(trendsData?.posts?.trend as 'up' | 'down') || 'up'}
          icon={<FileText size={20} />}
          color="indigo"
        />
        <StatCard 
          title="Active Users"
          value={data?.users || 0}
          change={trendsData?.users?.change || "+0%"}
          trend={(trendsData?.users?.trend as 'up' | 'down') || 'up'}
          icon={<Users size={20} />}
          color="purple"
        />
        <StatCard 
          title="Comments"
          value={data?.comments || 0}
          change={trendsData?.comments?.change || "+0%"}
          trend={(trendsData?.comments?.trend as 'up' | 'down') || 'up'}
          icon={<MessageSquare size={20} />}
          color="pink"
        />
        <StatCard 
          title="Total Views"
          value={viewsData?.total || 0}
          change={viewsData?.growth || "+0%"}
          trend={(viewsData?.trend as 'up' | 'down') || 'up'}
          icon={<Eye size={20} />}
          color="slate"
        />
      </div>

      {/* ✅ Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* Left Column - Quick Actions + Activity */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Quick Actions Bar */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quick Actions
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                to="/admin/posts/new"
                className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900 p-4 transition-all hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400">
                  <Plus size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">New Post</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Write article</div>
                </div>
              </Link>

              <Link
                to="/admin/posts"
                className="group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <Edit3 size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">Edit Posts</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Manage content</div>
                </div>
              </Link>

              <Link
                to="/admin/settings/general"
                className="group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <CheckCircle size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">Settings</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Site config</div>
                </div>
              </Link>
            </div>
          </div>

          {/* ✅ Recent Activity - REAL DATA */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
              <Link 
                to="/admin/posts" 
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                View all <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-4">
              {activity && activity.length > 0 ? (
                activity.slice(0, 4).map((item, index) => (
                  <ActivityItem 
                    key={index}
                    icon={getIconForType(item.type)}
                    title={item.title}
                    description={item.description}
                    time={formatTime(item.time)}
                    color={getColorForType(item.type)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No recent activity
                </div>
              )}
            </div>
          </div>

          {/* ✅ Content Overview - REAL DATA */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Content Overview</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {data?.posts || 0}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Published Posts</div>
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <TrendingUp size={14} />
                  <span className="font-medium">Active</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {data?.tags || 0}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Total Tags</div>
                <div className="mt-2 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                  <BarChart3 size={14} />
                  <span className="font-medium">Categories</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Quick Access + This Week */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ✅ Quick Access - NOW VISUALLY DISTINCT */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Access</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Jump to
              </span>
            </div>
            
            <div className="space-y-3">
              <QuickAccessLink
                icon={<FileText size={18} />}
                label="Posts"
                value={data?.posts || 0}
                href="/admin/posts"
                color="indigo"
              />
              <QuickAccessLink
                icon={<MessageSquare size={18} />}
                label="Comments"
                value={data?.comments || 0}
                href="/admin/comments"
                color="purple"
              />
              <QuickAccessLink
                icon={<Users size={18} />}
                label="Users"
                value={data?.users || 0}
                href="/admin/users"
                color="pink"
              />
              {data?.tags !== undefined && (
                <QuickAccessLink
                  icon={<BarChart3 size={18} />}
                  label="Tags"
                  value={data.tags}
                  href="/admin/tags"
                  color="slate"
                />
              )}
            </div>
          </div>

          {/* ✅ This Week - REAL DATA */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">This Week</h3>
            
            <div className="space-y-4">
              {weeklyData ? (
                <>
                  <MetricItem
                    label="New Posts"
                    value={weeklyData.posts.count.toString()}
                    change={`${weeklyData.posts.change} from last week`}
                    positive={weeklyData.posts.positive}
                  />
                  <MetricItem
                    label="New Comments"
                    value={weeklyData.comments.count.toString()}
                    change={`${weeklyData.comments.change} from last week`}
                    positive={weeklyData.comments.positive}
                  />
                  <MetricItem
                    label="Page Views"
                    value={weeklyData.views.count.toLocaleString()}
                    change={`${weeklyData.views.change} from last week`}
                    positive={weeklyData.views.positive}
                  />
                </>
              ) : (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                  Loading metrics...
                </div>
              )}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 mb-3">
              💡 Pro Tip
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Customize your site's look and feel in <Link to="/admin/settings/branding" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Settings → Branding</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ====================== COMPONENTS ====================== */

interface StatCardProps {
  title: string;
  value: number | string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
  color: 'indigo' | 'purple' | 'pink' | 'slate';
}

const colorClasses = {
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
  pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const StatCard = ({ title, value, change, trend, icon, color }: StatCardProps) => (
  <div className="admin-card p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</div>
      <div className={`rounded-xl p-2.5 ${colorClasses[color]}`}>
        {icon}
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    <div className={`text-sm font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {change} this month
    </div>
  </div>
);

interface ActivityItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  color: 'indigo' | 'purple' | 'pink' | 'slate';
}

const ActivityItem = ({ icon, title, description, time, color }: ActivityItemProps) => (
  <div className="flex items-start gap-4">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorClasses[color]}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-medium text-slate-900 dark:text-white">{title}</div>
      <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{description}</div>
      <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">{time}</div>
    </div>
  </div>
);

/* ✅ NEW: QuickAccessLink - Visually distinct from stats */
interface QuickAccessLinkProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  color: 'indigo' | 'purple' | 'pink' | 'slate';
}

const QuickAccessLink = ({ icon, label, value, href, color }: QuickAccessLinkProps) => (
  <Link
    to={href}
    className="group flex items-center gap-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 transition-all hover:border-indigo-300 hover:bg-indigo-50 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30 hover:shadow-md"
  >
    <div className={`rounded-lg p-2 transition-colors ${colorClasses[color]} group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
    <ExternalLink 
      size={16} 
      className="text-slate-400 opacity-0 transition-all group-hover:opacity-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5" 
    />
  </Link>
);

interface MetricItemProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

const MetricItem = ({ label, value, change, positive }: MetricItemProps) => (
  <div className="flex items-center justify-between">
    <div>
      <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
      <div className={`text-xs mt-1 ${positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {change}
      </div>
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);