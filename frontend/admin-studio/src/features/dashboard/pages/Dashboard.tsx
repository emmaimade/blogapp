// Dashboard.tsx
import { Link } from 'react-router-dom';
import { 
  BarChart3, Edit3, Eye, FileText, MessageSquare, Plus, 
  Settings, Tag, Users, ArrowUpRight, Feather, Globe, Clock, AlertTriangle 
} from 'lucide-react';
import { formatRelative } from '../../../shared/utils/dates';
import { useDashboard } from '../hooks/useDashboard';
import { StatCard, PublishProgress, QuickAction, DashboardSkeleton } from '../components/DashboardComponents';
import { SiteCard } from '../components/SiteCard';

export const Dashboard = () => {
  const {
    user, activeBlog, permissions, data, isLoading, error, refetch, subscription, greeting, today, isOwner
  } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Failed to load dashboard.</p>
        <button onClick={() => refetch()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Profile Greeting Row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{greeting}, {user?.first_name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400 font-medium">{today} · {data.blog_name}</p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto mt-1 md:mt-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-wide ${data.role === 'owner' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : data.role === 'editor' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
            {data.role}
          </span>
          {permissions.canManagePosts && (
            <Link to="/admin/posts/new" className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 active:scale-95">
              <Plus size={16} /> New post
            </Link>
          )}
        </div>
      </div>

      {/* System soft-lock warning banner */}
      {activeBlog && activeBlog.is_active === false && (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"><AlertTriangle size={18} /></div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Workspace Read-Only Soft-Lock Active</h4>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">This publication has been systematically suspended by infrastructure administration. Reader public routing addresses are locked, and modifications are restricted until reinstated.</p>
            </div>
          </div>
          {isOwner && <a href="mailto:support@inko.blog" className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 self-start sm:self-auto">Contact Administration</a>}
        </div>
      )}

      {/* Primary Analytic Metrics Matrices Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Total Posts" value={data.posts} sub={`${data.published_posts} live · ${data.draft_posts} drafts · ${data.scheduled_posts} scheduled`} icon={<FileText size={16} />} accent />
        <StatCard title="Live Posts" value={data.published_posts} sub="Published & visible" icon={<Globe size={16} />} />
        <StatCard title="Scheduled" value={data.scheduled_posts} sub="Will publish automatically" icon={<Clock size={16} />} />
        <StatCard title="Total Views" value={data.total_views} sub="Across all posts" icon={<Eye size={16} />} />
        <StatCard title="Comments" value={data.comments} sub="Reader engagement" icon={<MessageSquare size={16} />} />
      </div>

      <PublishProgress published={data.published_posts} scheduled={data.scheduled_posts} total={data.posts} />

      {/* Main Structural Columns Blocks Layout Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column Section: Shortcuts & Audit Feeds */}
        <div className="space-y-6 lg:col-span-3">
          {(permissions.canManagePosts || permissions.canManageSettings) && (
            <div className="admin-card p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Quick actions</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {permissions.canManagePosts && <QuickAction to="/admin/posts/new" icon={<Feather size={18} />} label="Write new post" desc="Start from blank slate" primary />}
                {permissions.canManagePosts && <QuickAction to="/admin/posts" icon={<Edit3 size={18} />} label="Manage posts" desc="Edit and publish content" />}
                {permissions.canManageTags && <QuickAction to="/admin/tags" icon={<Tag size={18} />} label="Manage tags" desc={`${data.tags} tags in workspace`} />}
                {permissions.canManageComments && <QuickAction to="/admin/comments" icon={<MessageSquare size={18} />} label="Moderate comments" desc={`${data.comments} total comments`} />}
                {permissions.canManageUsers && <QuickAction to="/admin/users" icon={<Users size={18} />} label="Team" desc={`${data.team_members} member${data.team_members !== 1 ? "s" : ""}`} />}
                {permissions.canManageSettings && <QuickAction to="/admin/settings/general" icon={<Settings size={18} />} label="Settings" desc="Configure your workspace" />}
              </div>
            </div>
          )}

          {/* Activity Log Feed Module */}
          <div className="admin-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recent activity</h3>
              {permissions.canManagePosts && <Link to="/admin/posts" className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">View all <ArrowUpRight size={12} /></Link>}
            </div>
            {data.recent_activity.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.recent_activity.map((item, i) => (
                  <div key={`${item.title}-${i}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      <FileText size={14} className="text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{formatRelative(item.time)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800"><Feather size={22} className="text-zinc-400" /></div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No activity yet</p>
                {permissions.canManagePosts && <Link to="/admin/posts/new" className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">Write your first post →</Link>}
              </div>
            )}
          </div>
        </div>

        {/* Right Column Section: Global Configuration & Context Tables */}
        <div className="space-y-6 lg:col-span-2">
          {isOwner && activeBlog && (
            <SiteCard subdomain={activeBlog.subdomain} customDomain={activeBlog.custom_domain} plan={subscription?.plan} canManageSettings={permissions.canManageSettings} />
          )}

          {/* Quick List Overview Matrix */}
          <div className="admin-card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            <div className="p-5"><h3 className="text-sm font-bold text-zinc-900 dark:text-white">Workspace overview</h3></div>
            {[
              { label: "Published posts", value: data.published_posts, icon: <BarChart3 size={14} /> },
              { label: "Scheduled posts", value: data.scheduled_posts, icon: <Clock size={14} /> },
              { label: "Draft posts", value: data.draft_posts, icon: <Edit3 size={14} /> },
              { label: "Comments", value: data.comments, icon: <MessageSquare size={14} /> },
              { label: "Tags", value: data.tags, icon: <Tag size={14} /> },
              { label: "Team members", value: data.team_members, icon: <Users size={14} /> },
              { label: "Total views", value: data.total_views, icon: <Eye size={14} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
                  {label}
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white">{value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};