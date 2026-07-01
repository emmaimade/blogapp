import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, User, Building2, Settings, Trash2, LogIn, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import api from '../../../shared/api/client';
import { formatLocalDate, formatSmart } from '../../../shared/utils/dates';

interface AuditLogEntry {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  actor: string | null;
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

// Action type config — icon + colour
const actionConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'user.login':                         { icon: <LogIn size={13} />,        color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  'user.register':                      { icon: <User size={13} />,         color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'blog.create':                        { icon: <Building2 size={13} />,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'blog.delete':                        { icon: <Trash2 size={13} />,       color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  'platform_settings.update_general':   { icon: <Settings size={13} />,     color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

const defaultIconConfig = { icon: <ShieldCheck size={13} />, color: 'text-zinc-600', bg: 'bg-zinc-50 dark:bg-zinc-900/20' };

const PAGE_SIZE = 50;

export const SuperAdminAuditLogPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [resourceFilter, setResourceFilter] = useState('all');

  // Server-side audit log fetch structured query parameters setup
  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['superadmin-audit-logs', page, resourceFilter],
    queryFn: async () => {
      const res = await api.get('/superadmin/audit-logs', {
        params: {
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          resource_type: resourceFilter !== 'all' ? resourceFilter : undefined,
        },
      });
      return res.data;
    },
  });

  // Client-side quick filter text filter search string match
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
    <div className="space-y-6">
      {/* Search and Filters Header Menu Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white p-4 shadow-sm dark:bg-zinc-950">
        <div className="flex flex-1 items-center gap-3 min-w-[300px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search platform logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400"
            />
          </div>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">All Resources</option>
            <option value="user">User Actions</option>
            <option value="blog">Workspace Blogs</option>
            <option value="platform_settings">Platform Settings</option>
          </select>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-white dark:bg-zinc-900 transition-all"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Container Ledger Block */}
      <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white shadow-sm dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin" />
            <span className="text-xs text-zinc-400">Loading system operations feed...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-sm">
            No system administration audit entries found.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {filteredLogs.map((log) => {
              const config = actionConfig[log.action] || defaultIconConfig;
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all">
                  <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color}`}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {log.action}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {log.resource_type}
                      </span>
                    </div>
                    {log.description && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 truncate">{log.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                      {log.actor_email && (
                        <span className="flex items-center gap-1">
                          <User size={11} /> {log.actor_email}
                        </span>
                      )}
                      {log.ip_address && (
                        <span className="font-mono bg-zinc-50 dark:bg-zinc-900 px-1 rounded text-[11px]">
                          IP: {log.ip_address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp alignment block side container section */}
                  <div className="text-xs text-zinc-400 flex-shrink-0 text-right">
                    {log.created_at ? (
                      <>
                        <div className="font-medium text-zinc-500 dark:text-zinc-400">{formatLocalDate(log.created_at)}</div>
                        <div className="text-[11px] text-zinc-400">{formatSmart(log.created_at)}</div>
                      </>
                    ) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic Footer pagination alignment block */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            Showing {filteredLogs.length} entries · Page {page + 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE || isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}