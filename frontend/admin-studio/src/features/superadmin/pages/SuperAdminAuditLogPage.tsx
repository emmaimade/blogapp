import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, User, Building2, Settings, Trash2, CheckCircle2, XCircle, LogIn } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchAuditLogs = async () => {
  const res = await axios.get(`${API_URL}/superadmin/audit-logs`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

// Action type config — icon + colour
const actionConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'user.login':                         { icon: <LogIn size={13} />,        color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  'user.register':                      { icon: <User size={13} />,         color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'blog.create':                        { icon: <Building2 size={13} />,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'superadmin.blog_status_update':      { icon: <CheckCircle2 size={13} />, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'superadmin.blog_delete':             { icon: <Trash2 size={13} />,       color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  'superadmin.user_status_update':      { icon: <XCircle size={13} />,      color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  'superadmin.platform_settings_update': { icon: <Settings size={13} />,    color: 'text-primary',    bg: 'bg-accent' },
  'comment.delete':                     { icon: <Trash2 size={13} />,       color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  'comment.moderator_delete':           { icon: <Trash2 size={13} />,       color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  'moderation.remove':                  { icon: <Trash2 size={13} />,       color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  'moderation.approve':                 { icon: <CheckCircle2 size={13} />, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'moderation.reject':                  { icon: <XCircle size={13} />,      color: 'text-zinc-600',   bg: 'bg-zinc-100 dark:bg-zinc-700' },
};

const defaultConfig = { icon: <ShieldCheck size={13} />, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-700' };

type FilterType = 'all' | 'blogs' | 'users' | 'settings' | 'auth';

const filterMap: Record<FilterType, string[]> = {
  all:      [],
  blogs:    ['blog.create', 'superadmin.blog_status_update', 'superadmin.blog_delete'],
  users:    ['user.register', 'user.update_profile', 'user.delete_account', 'superadmin.user_status_update'],
  settings: ['superadmin.platform_settings_update', 'comment.delete', 'comment.moderator_delete', 'moderation.remove', 'moderation.approve', 'moderation.reject'],
  auth:     ['user.login'],
};

export const SuperAdminAuditLogPage = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['superadmin-audit-logs'],
    queryFn: fetchAuditLogs,
  });

  const allLogs = logs ?? [];

  const filtered = allLogs.filter((log: any) => {
    const matchesSearch =
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.actor?.toLowerCase().includes(search.toLowerCase()) ||
      log.description?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter !== 'all' && filterMap[filter].length > 0) {
      return filterMap[filter].includes(log.action);
    }
    return true;
  });

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'blogs',    label: 'Blogs' },
    { key: 'users',    label: 'Users' },
    { key: 'settings', label: 'Settings' },
    { key: 'auth',     label: 'Auth' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Audit Log</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">A chronological record of all superadmin actions on the platform.</p>
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === key
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search logs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-48" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-72" />
                </div>
                <div className="h-3 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ShieldCheck size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-500 text-sm">
              {search || filter !== 'all' ? 'No logs match your filters.' : 'No audit log entries yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {filtered.map((log: any, i: number) => {
              const config = actionConfig[log.action] ?? defaultConfig;
              const ts = log.created_at ? new Date(log.created_at) : null;
              return (
                <div key={log.id ?? i} className="flex items-start gap-4 px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  {/* Action icon */}
                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5 ${config.color}`}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {log.action?.replace(/[._]/g, ' ')}
                      </span>
                      {log.target_type && (
                        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                          {log.target_type}
                        </span>
                      )}
                    </div>
                    {log.description && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{log.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                      {log.actor && (
                        <span className="flex items-center gap-1">
                          <User size={11} /> {log.actor}
                        </span>
                      )}
                      {log.ip_address && (
                        <span className="font-mono">{log.ip_address}</span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-zinc-400 flex-shrink-0 text-right">
                    {ts ? (
                      <>
                        <div>{ts.toLocaleDateString()}</div>
                        <div>{ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </>
                    ) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {!isLoading && allLogs.length > 0 && (
          <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-700">
            <p className="text-xs text-zinc-400">Showing {filtered.length} of {allLogs.length} entries. Logs are retained for 90 days.</p>
          </div>
        )}
      </div>
    </div>
  );
};
