import { useQuery } from '@tanstack/react-query';
import { Edit3, FileText, LogIn, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useBlog } from '../../../app/providers/BlogProvider';
import api from '../../../shared/api/client';
import { formatLocalDateTime, formatSmart } from '../../../shared/utils/dates';
import { useAuth } from '../../auth/context/AuthContext';

interface AuditLogEntry {
  id: number;
  action: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
  actor_email: string | null;
}

interface ContextualActivityLogTabProps {
  targetUserId: number;
  targetUserEmail: string | null;
  targetUser?: any;
}

const PAGE_SIZE = 15;

export default function ContextualActivityLogTab({ targetUserId, targetUserEmail }: ContextualActivityLogTabProps) {
  const { user: currentUser } = useAuth();
  const { activeBlog, activeRole } = useBlog();
  const [page, setPage] = useState(0);

  // 1. Establish the 3-Tier Relationship Visibility Context
  const isSelf = currentUser?.id === targetUserId;
  const isSuperadmin = currentUser?.is_super_admin === true || currentUser?.platform_role === 'super_admin';
  const isBlogOwner = activeRole === 'owner';

  let accessTier: 'superadmin' | 'owner' | 'self' | 'denied' = 'denied';
  if (isSuperadmin) accessTier = 'superadmin';
  else if (isBlogOwner && !isSelf) accessTier = 'owner';
  else if (isSelf) accessTier = 'self';

  // 2. Query execution with verified backend endpoints
  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['contextual-audit-logs', targetUserId, accessTier, page, activeBlog?.id],
    queryFn: async () => {
      let url = '/users/me/audit-logs';
      let params: Record<string, any> = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };

      // Correct endpoints matching your existing backend router architecture
      if (accessTier === 'superadmin') {
        url = '/superadmin/audit-logs';
        params.actor_user_id = targetUserId;
      } else if (accessTier === 'owner') {
        url = `/blogs/${activeBlog?.id}/audit-logs`;
        params.actor_email = targetUserEmail || undefined;
      }

      const res = await api.get(url, { params });
      return Array.isArray(res.data) ? res.data : (res.data.logs || []);
    },
    enabled: accessTier !== 'denied' && (accessTier !== 'owner' || !!activeBlog?.id),
  });

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('login') || act.includes('auth')) return <LogIn size={14} className="text-blue-500" />;
    if (act.includes('create') || act.includes('publish')) return <FileText size={14} className="text-emerald-500" />;
    if (act.includes('update') || act.includes('patch') || act.includes('edit')) return <Edit3 size={14} className="text-amber-500" />;
    if (act.includes('delete') || act.includes('remove')) return <Trash2 size={14} className="text-rose-500" />;
    return <Settings size={14} className="text-zinc-400" />;
  };

  if (accessTier === 'denied') {
    return (
      <div className="p-6 text-center text-xs text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl">
        Security Boundary: You do not have permission to view this user's activity log ledger.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scope Indicator Ribbon */}
      <div className="flex items-center justify-between text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-3.5 border border-zinc-200/60 dark:border-zinc-800/60">
        <div className="text-zinc-500 dark:text-zinc-400">
          Viewing mode:{' '}
          <span className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-1">
            {accessTier === 'superadmin' && 'Global Infrastructure Context'}
            {accessTier === 'owner' && `Tenant Scope (${activeBlog?.name || 'Current Workspace'})`}
            {accessTier === 'self' && 'Personal Security Trail'}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-white dark:bg-zinc-950 transition-all"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Ledger Feed Panel */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <RefreshCw className="h-5 w-5 text-zinc-400 animate-spin" />
            <p className="text-xs text-zinc-400">Filtering timeline structures...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No tracked timeline operations match this user identifier scope.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 text-xs transition-colors">
                <div className="mt-0.5 h-7 w-7 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-center flex-shrink-0">
                  {getActionIcon(log.action)}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-200 capitalize">
                      {log.action.replace(/[._]/g, ' ')}
                    </span>
                  </div>
                  {log.description && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                      {log.description}
                    </p>
                  )}
                  <div className="flex gap-3 text-[10px] text-zinc-400 pt-1">
                    {log.ip_address && <span>IP: {log.ip_address}</span>}
                    {accessTier === 'superadmin' && log.actor_email && (
                      <span>Actor: {log.actor_email}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 text-[10px] text-zinc-400 pt-0.5" title={formatLocalDateTime(log.created_at)}>
                  {formatSmart(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/50 dark:bg-zinc-900/20 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-400">Page {page + 1}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="px-2.5 py-1 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 hover:bg-zinc-50 text-zinc-600 dark:text-zinc-400 disabled:opacity-40 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE || isLoading}
              className="px-2.5 py-1 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 hover:bg-zinc-50 text-zinc-600 dark:text-zinc-400 disabled:opacity-40 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}