import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ShieldCheck, Search, FileText, Users,
  Settings, Globe, Tag,
  Trash2, Edit3, UserPlus,
  RefreshCw,
} from 'lucide-react';
import { formatRelative, formatAuditTs } from '../../../shared/utils/dates';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

interface AuditLogEntry {
  id: number;
  actor: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  target_type: string | null;
  resource_id: number | null;
  blog_id: number | null;
  details: Record<string, any> | null;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

// ── Action config — icon, colour, label ──────────────────────────────────────
interface ActionConfig {
  icon: ReactNode;
  color: string;
  bg: string;
  label: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  'post.created':            { icon: <FileText size={13} />,    color: 'text-blue-600',       bg: 'bg-blue-50 dark:bg-blue-900/20',       label: 'Created Post' },
  'post.updated':            { icon: <FileText size={13} />,    color: 'text-amber-600',      bg: 'bg-amber-50 dark:bg-amber-900/20',     label: 'Updated Post' },
  'post.deleted':            { icon: <Trash2 size={13} />,      color: 'text-red-600',        bg: 'bg-red-50 dark:bg-red-900/20',         label: 'Deleted Post' },
  'post.welcome_created':    { icon: <FileText size={13} />,    color: 'text-blue-600',       bg: 'bg-blue-50 dark:bg-blue-900/20',       label: 'Created Welcome Post' },
  'blog.member_add':         { icon: <UserPlus size={13} />,    color: 'text-purple-600',     bg: 'bg-purple-50 dark:bg-purple-900/20',   label: 'Added Member' },
  'blog.member_permissions_update': { icon: <Users size={13} />, color: 'text-zinc-600',      bg: 'bg-zinc-50 dark:bg-zinc-900/20',       label: 'Updated Member Role' },
  'blog.member_remove':      { icon: <Trash2 size={13} />,      color: 'text-red-600',        bg: 'bg-red-50 dark:bg-red-900/20',         label: 'Removed Member' },
  'settings.updated':        { icon: <Settings size={13} />,    color: 'text-zinc-600',       bg: 'bg-zinc-50 dark:bg-zinc-900/20',       label: 'Updated Settings' },
  'branding.updated':        { icon: <Globe size={13} />,       color: 'text-indigo-600',     bg: 'bg-indigo-50 dark:bg-indigo-900/20',   label: 'Updated Branding' },
  'tag.created':             { icon: <Tag size={13} />,         color: 'text-teal-600',       bg: 'bg-teal-50 dark:bg-teal-900/20',       label: 'Created Tag' },
  'tag.deleted':             { icon: <Trash2 size={13} />,      color: 'text-red-600',        bg: 'bg-red-50 dark:bg-red-900/20',         label: 'Deleted Tag' },
};

const getActionConfig = (action: string): ActionConfig => {
  if (ACTION_CONFIG[action]) return ACTION_CONFIG[action];
  if (action.endsWith('.deleted') || action.includes('remove')) {
    return { icon: <Trash2 size={13} />, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', label: action };
  }
  if (action.endsWith('.updated') || action.includes('update')) {
    return { icon: <Edit3 size={13} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', label: action };
  }
  return { icon: <ShieldCheck size={13} />, color: 'text-zinc-600', bg: 'bg-zinc-50 dark:bg-zinc-900/20', label: action };
};

const PAGE_SIZE = 50;

export const ActivityLogPage = () => {
  const { activeBlog } = useBlog();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  // Server-side filtering & pagination hook
  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-logs', activeBlog?.id, page, resourceFilter, actionFilter],
    queryFn: async () => {
      const res = await api.get(`/blogs/${activeBlog?.id}/audit-logs`, {
        params: {
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          action: actionFilter !== 'all' ? actionFilter : undefined,
          resource_type: resourceFilter !== 'all' ? resourceFilter : undefined,
        },
      });
      return res.data;
    },
    enabled: !!activeBlog?.id,
  });

  // Client-side text match helper for granular inline descriptions
  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      log.description?.toLowerCase().includes(term) ||
      log.actor_email?.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term)
    );
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-[#ededed]">
          Workspace Audit Log
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          A secure ledger of administrative actions occurring inside this workspace.
        </p>
      </div>

      {/* Control Filters Area */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 p-3 border border-zinc-100 dark:border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search bar */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search descriptions, actors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 transition-all"
            />
          </div>

          {/* Resource Filter */}
          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none transition-all"
          >
            <option value="all">All Resources</option>
            <option value="post">Posts</option>
            <option value="blog_member">Members</option>
            <option value="settings">Settings</option>
            <option value="tag">Tags</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none transition-all"
          >
            <option value="all">All Actions</option>
            <option value="post.created">Created</option>
            <option value="post.updated">Updated</option>
            <option value="post.deleted">Deleted</option>
            <option value="blog.member_add">Member Added</option>
            <option value="blog.member_permissions_update">Role Updated</option>
            <option value="blog.member_remove">Member Removed</option>
            <option value="settings.updated">Settings Updated</option>
            <option value="branding.updated">Branding Updated</option>
          </select>
        </div>

        {/* Sync Status Button */}
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-white dark:bg-zinc-950 transition-all disabled:opacity-40"
          title="Refresh Log Feed"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Audit Logs Content Feed */}
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin" />
            <p className="text-xs text-zinc-400 font-medium">Retrieving workspace parameters...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-100 dark:border-zinc-800">
              <ShieldCheck size={18} />
            </div>
            <h3 className="mt-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100">No activity matching your filter</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-xs">No records could be parsed targeting these criteria from the operational audit ledger.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {filteredLogs.map((log) => {
              const cfg = getActionConfig(log.action);
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                  {/* Status Circle Badge Indicator */}
                  <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  {/* Main Event Properties Context */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                        {cfg.label}
                      </p>
                    </div>
                    {log.description && (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {log.description}
                      </p>
                    )}

                    {/* Metadata tags line footer */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-zinc-400">
                      {log.actor_email && (
                        <span className="flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-400">
                          Actor: {log.actor_email}
                        </span>
                      )}
                      {log.ip_address && (
                        <span className="font-mono bg-zinc-50 dark:bg-zinc-900 px-1 rounded">
                          IP: {log.ip_address}
                        </span>
                      )}
                      <span>•</span>
                      <span>ID: #{log.id}</span>
                    </div>
                  </div>

                  {/* Time badge side block */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] font-medium text-zinc-400" title={formatAuditTs(log.created_at)}>
                      {formatRelative(log.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Interface Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-400">
            Showing {filteredLogs.length} entries · Page {page + 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE || isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
