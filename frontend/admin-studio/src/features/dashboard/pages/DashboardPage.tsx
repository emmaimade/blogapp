import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Edit3, Eye, FileText, MessageSquare,
  Plus, Settings, Tag, Users, ArrowUpRight, Feather,
  Globe, ExternalLink, Copy, CheckCircle2, Lock, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import api from '../../../shared/api/client';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import { canAccess } from '../../auth/lib/accessControl';

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  time: string;
}

interface DashboardSummary {
  blog_id: number;
  blog_name: string;
  role: 'owner' | 'editor' | 'author';
  posts: number;
  published_posts: number;
  draft_posts: number;
  comments: number;
  tags: number;
  team_members: number;
  total_views: number;
  recent_activity: ActivityItem[];
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatTime = (isoTime: string) => {
  try { return formatDistanceToNow(new Date(isoTime), { addSuffix: true }); }
  catch { return 'recently'; }
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
  title, value, sub, icon, accent = false,
}: {
  title: string; value: number; sub: string;
  icon: React.ReactNode; accent?: boolean;
}) => (
  <div className={`admin-card flex flex-col gap-4 p-5 ${accent ? 'ring-1 ring-violet-200 dark:ring-violet-800/50' : ''}`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
        {icon}
      </div>
    </div>
    <div>
      <div className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{sub}</div>
    </div>
  </div>
);

// ─── Publish Progress ─────────────────────────────────────────────────────────
const PublishProgress = ({ published, total }: { published: number; total: number }) => {
  const pct = total > 0 ? Math.round((published / total) * 100) : 0;
  return (
    <div className="admin-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Publishing rate</span>
        <span className="text-sm font-bold text-zinc-900 dark:text-white">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{published} published</span>
        <span>{total - published} drafts</span>
      </div>
    </div>
  );
};

// ─── Quick Action ─────────────────────────────────────────────────────────────
const QuickAction = ({
  to, icon, label, desc, primary = false,
}: {
  to: string; icon: React.ReactNode; label: string; desc: string; primary?: boolean;
}) => (
  <Link
    to={to}
    className={`group flex items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
      primary
        ? 'border-violet-200 bg-violet-50 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-950/30 dark:hover:border-violet-700'
        : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700'
    }`}
  >
    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
      primary ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
    }`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className={`font-semibold ${primary ? 'text-violet-800 dark:text-violet-300' : 'text-zinc-900 dark:text-white'}`}>{label}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</div>
    </div>
    <ArrowUpRight size={16} className="flex-shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-zinc-600" />
  </Link>
);

// ─── Site Card ────────────────────────────────────────────────────────────────
const SiteCard = ({
  blogName,
  subdomain,
  customDomain,
  plan,
  canManageSettings,
}: {
  blogName: string;
  subdomain: string;
  customDomain?: string | null;
  plan?: string;
  canManageSettings: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const isPro = plan === 'pro' || plan === 'team';
  const BLOG_BASE_URL = import.meta.env.VITE_BLOG_URL || 'http://localhost:5174';
  const liveUrl = customDomain
    ? `https://${customDomain}`
    : import.meta.env.DEV
      ? `${BLOG_BASE_URL}`
      : `https://${subdomain}.inko.blog`;
  const displayUrl = customDomain ?? (import.meta.env.DEV ? BLOG_BASE_URL.replace(/^https?:\/\//, '') : `${subdomain}.inko.blog`);

  const handleCopy = () => {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="admin-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-violet-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Your blog</h3>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">Live</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* URL row */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <span className="flex-1 text-sm font-mono font-semibold text-zinc-900 dark:text-white truncate">
            {displayUrl}
          </span>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            title="Copy URL"
          >
            {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400"
            title="Open blog"
          >
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Custom domain nudge */}
        {!customDomain && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            isPro
              ? 'border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/30'
              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50'
          }`}>
            {isPro ? (
              <Zap size={14} className="text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Lock size={14} className="text-zinc-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isPro ? 'Connect a custom domain' : 'Custom domain on Pro plan'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isPro
                  ? 'Replace your .inko.blog address with your own domain.'
                  : 'Upgrade to use your own domain like blog.yoursite.com.'}
              </p>
            </div>
            {canManageSettings && (
              <Link
                to={isPro ? '/admin/settings/general' : '/admin/settings/general'}
                className="flex-shrink-0 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
              >
                {isPro ? 'Set up →' : 'Upgrade →'}
              </Link>
            )}
          </div>
        )}

        {/* Custom domain active state */}
        {customDomain && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <CheckCircle2 size={13} className="text-green-500" />
            Custom domain active
            {canManageSettings && (
              <Link to="/admin/settings/general" className="ml-auto text-violet-600 dark:text-violet-400 font-semibold hover:underline">
                Manage →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const Dashboard = () => {
  const { user } = useAuth();
  const { activeBlog, activeMembership } = useBlog();
  const canManagePosts    = canAccess(user, activeMembership, 'manage_posts');
  const canManageSettings = canAccess(user, activeMembership, 'manage_settings');
  const canManageUsers    = canAccess(user, activeMembership, 'manage_users');
  const canManageComments = canAccess(user, activeMembership, 'manage_comments');
  const canManageTags     = canAccess(user, activeMembership, 'manage_tags');

  const { data, isLoading, error, refetch } = useQuery<DashboardSummary>({
    queryKey: ['blogDashboard', activeMembership?.blog_id],
    queryFn: async () => (await api.get('/dashboard')).data,
    enabled: !!activeMembership,
    refetchInterval: 30000,
  });

  // Subscription query — to gate custom domain nudge correctly
  const { data: subscription } = useQuery({
    queryKey: ['subscription', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog?.id}/subscription`)).data,
    enabled: !!activeBlog?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-8 w-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-40 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-card flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-8 w-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div>
                <div className="h-8 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-2 h-3 w-32 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Failed to load dashboard.</p>
        <button
          onClick={() => refetch()}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const isOwner = data.role === 'owner';

  return (
    <div className="space-y-6">

      {/* ─── Header greeting ─── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">
            {getGreeting()}, {user?.username?.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{today} · {data.blog_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            data.role === 'owner'  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
            : data.role === 'editor' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          }`}>
            {data.role}
          </span>
          {canManagePosts && (
            <Link
              to="/admin/posts/new"
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              <Plus size={16} /> New post
            </Link>
          )}
        </div>
      </div>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Posts"   value={data.posts}        sub={`${data.published_posts} published · ${data.draft_posts} drafts`} icon={<FileText size={16} />} accent />
        <StatCard title="Total Views"   value={data.total_views}  sub="Across all posts"    icon={<Eye size={16} />} />
        <StatCard title="Comments"      value={data.comments}     sub="Reader engagement"   icon={<MessageSquare size={16} />} />
        <StatCard title="Team Members"  value={data.team_members} sub={`${data.tags} tags`} icon={<Users size={16} />} />
      </div>

      {/* ─── Publishing progress ─── */}
      <PublishProgress published={data.published_posts} total={data.posts} />

      {/* ─── Main 2-col grid ─── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Left — Quick actions + Recent activity */}
        <div className="space-y-6 lg:col-span-3">

          {/* Quick Actions */}
          {(canManagePosts || canManageSettings) && (
            <div className="admin-card p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Quick actions</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {canManagePosts && (
                  <QuickAction to="/admin/posts/new" icon={<Feather size={18} />} label="Write new post" desc="Start from blank slate" primary />
                )}
                {canManagePosts && (
                  <QuickAction to="/admin/posts" icon={<Edit3 size={18} />} label="Manage posts" desc="Edit and publish content" />
                )}
                {canManageTags && (
                  <QuickAction to="/admin/tags" icon={<Tag size={18} />} label="Manage tags" desc={`${data.tags} tags in workspace`} />
                )}
                {canManageComments && (
                  <QuickAction to="/admin/comments" icon={<MessageSquare size={18} />} label="Moderate comments" desc={`${data.comments} total comments`} />
                )}
                {canManageUsers && (
                  <QuickAction to="/admin/users" icon={<Users size={18} />} label="Team" desc={`${data.team_members} member${data.team_members !== 1 ? 's' : ''}`} />
                )}
                {canManageSettings && (
                  <QuickAction to="/admin/settings/general" icon={<Settings size={18} />} label="Settings" desc="Configure your workspace" />
                )}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="admin-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recent activity</h3>
              {canManagePosts && (
                <Link to="/admin/posts" className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
                  View all <ArrowUpRight size={12} />
                </Link>
              )}
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
                    <span className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{formatTime(item.time)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                  <Feather size={22} className="text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No activity yet</p>
                {canManagePosts && (
                  <Link to="/admin/posts/new" className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
                    Write your first post →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — Site card + Stats sidebar */}
        <div className="space-y-6 lg:col-span-2">

          {/* Site card — only shown to owners */}
          {isOwner && activeBlog && (
            <SiteCard
              blogName={data.blog_name}
              subdomain={activeBlog.subdomain}
              customDomain={activeBlog.custom_domain}
              plan={subscription?.plan}
              canManageSettings={canManageSettings}
            />
          )}

          {/* Workspace overview */}
          <div className="admin-card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            <div className="p-5">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Workspace overview</h3>
            </div>
            {[
              { label: 'Published posts', value: data.published_posts, icon: <BarChart3 size={14} /> },
              { label: 'Draft posts',     value: data.draft_posts,     icon: <Edit3 size={14} /> },
              { label: 'Comments',        value: data.comments,        icon: <MessageSquare size={14} /> },
              { label: 'Tags',            value: data.tags,            icon: <Tag size={14} /> },
              { label: 'Team members',    value: data.team_members,    icon: <Users size={14} /> },
              { label: 'Total views',     value: data.total_views,     icon: <Eye size={14} /> },
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

          {/* Workspace role card */}
          <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-5 text-white shadow-lg shadow-violet-500/20">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider opacity-70">Your workspace role</div>
            <div className="text-2xl font-black capitalize">{data.role}</div>
            <div className="mt-1 text-sm opacity-80">{data.blog_name}</div>
            {canManageSettings && (
              <Link
                to="/admin/settings/general"
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white"
              >
                <Settings size={12} /> Workspace settings <ArrowUpRight size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};