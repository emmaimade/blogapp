import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, ShieldCheck, MessageSquare } from 'lucide-react';
import { formatLocalDateTime, formatRelative } from '../../../shared/utils/dates';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { ActivityFeedSkeleton } from '../../../shared/ui/Skeleton';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

interface AuditLogEntry {
  id: number;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  description: string | null;
  details?: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  author: 'Author',
  viewer: 'Viewer',
};

const roleLabel = (role: unknown) =>
  typeof role === 'string' ? ROLE_LABELS[role.toLowerCase()] ?? role : String(role ?? 'unknown');

export const ActivityLogPage = () => {
  useDocumentTitle('Activity log');
  const { activeBlog } = useBlog();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');

  // Debounce so we're not firing a request on every keystroke — the search
  // itself now runs server-side (see backend), so each keystroke would
  // otherwise be a full round-trip.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-logs', activeBlog?.id, page, resourceFilter, debouncedSearch],
    queryFn: async () => {
      const res = await api.get(`/blogs/${activeBlog?.id}/audit-logs`, {
        params: {
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          resource_type: resourceFilter !== 'all' ? resourceFilter : undefined,
          search: debouncedSearch || undefined,
        },
      });
      return res.data;
    },
    enabled: !!activeBlog?.id,
  });

  // Filtering now happens server-side (see queryFn above) so page counts
  // stay accurate while searching — logs here is already the filtered set
  // for the current page.
  const groupedLogs = useMemo(() => {
    const order: string[] = [];
    const groups: Record<string, AuditLogEntry[]> = {};

    logs.forEach((log) => {
      const date = new Date(log.created_at);
      const now = new Date();

      let dateKey = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      if (date.toDateString() === now.toDateString()) {
        dateKey = 'Today';
      } else {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
          dateKey = 'Yesterday';
        }
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
        order.push(dateKey);
      }
      groups[dateKey].push(log);
    });

    // Logs arrive newest-first from the backend, so the order groups were
    // first encountered in is already the correct chronological order —
    // built explicitly here rather than relying on object key iteration order.
    return order.map((dateKey) => [dateKey, groups[dateKey]] as const);
  }, [logs]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Activity Log
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Track changes, content updates, and team actions across your workspace.
        </p>
      </div>

      {/* Control Bar */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-zinc-50/80 p-3.5 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center sm:min-w-65">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search activity or people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-zinc-800"
            />
          </div>

          <select
            value={resourceFilter}
            onChange={(e) => { setResourceFilter(e.target.value); setPage(0); }}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 sm:w-auto"
          >
            <option value="all">All Resources</option>
            <option value="post">Posts</option>
            <option value="comment">Comments</option>
            <option value="blog_member">Team Members</option>
            <option value="settings">Settings</option>
            <option value="tag">Tags</option>
          </select>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 transition sm:w-auto"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Activity Feed */}
      <div className="mt-8">
        {isLoading ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <ActivityFeedSkeleton rows={6} />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <ShieldCheck size={32} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No activity logged for this filter.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedLogs.map(([dateGroup, entries]) => (
              <div key={dateGroup} className="space-y-3">
                <div className="sticky top-0 z-10 bg-white/90 py-1 backdrop-blur-sm dark:bg-zinc-950/90">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {dateGroup}
                  </span>
                </div>

                <div className="relative ml-3 border-l-2 border-zinc-100 space-y-4 dark:border-zinc-800/80">
                  {entries.map((log) => {
                    const isReaderComment = log.resource_type === 'comment' && log.details?.commenter_role === 'reader';
                    const actorName = log.actor_email ? log.actor_email.split('@')[0] : 'System';
                    const initial = actorName.charAt(0).toUpperCase();

                    return (
                      <div key={log.id} className="relative pl-6">
                        {/* Actor Initial Node */}
                        <div className="absolute -left-[17px] top-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-xs font-bold text-zinc-600 shadow-sm dark:border-zinc-950 dark:bg-zinc-800 dark:text-zinc-300">
                          {isReaderComment ? <MessageSquare size={14} /> : initial}
                        </div>

                        {/* Content Box */}
                        <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700/80 transition">
                          <div className="min-w-0 flex-1">
                            {/* Title Description */}
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {log.description || formatFallbackAction(log)}
                            </p>

                            {/* Structured State Diffs */}
                            <FormattedDiffs log={log} />

                            {/* Metadata */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                              <span className="break-all font-medium text-zinc-600 dark:text-zinc-300">
                                {log.actor_email || 'System'}
                              </span>
                              {isReaderComment && (
                                <>
                                  <span>•</span>
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                    Reader
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <time title={formatLocalDateTime(log.created_at)}>
                                {formatRelative(log.created_at)}
                              </time>
                              {log.ip_address && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[11px]">{log.ip_address}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            Page {page + 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="rounded-xl border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE || isLoading}
              className="rounded-xl border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FormattedDiffs = ({ log }: { log: AuditLogEntry }) => {
  const details = log.details;
  if (!details || typeof details !== 'object') return null;

  if (log.resource_type === 'comment' && details.deleted_by) {
    const isModerator = details.deleted_by === 'moderator' || log.action === 'comment.moderator_delete';
    return (
      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
        isModerator
          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
      }`}>
        <span>{isModerator ? 'Removed by moderator' : 'Deleted by author'}</span>
      </div>
    );
  }

  if (details.changes?.role) {
    const { from, to } = details.changes.role;
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
        <span>Role changed:</span>
        <span className="font-semibold line-through opacity-70">{roleLabel(from)}</span>
        <span>→</span>
        <span className="font-bold">{roleLabel(to)}</span>
      </div>
    );
  }

  if (details.from !== undefined && details.to !== undefined) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <span className="font-medium line-through opacity-70">{String(details.from)}</span>
        <span>→</span>
        <span className="font-bold">{String(details.to)}</span>
      </div>
    );
  }

  if (details.changes && typeof details.changes === 'object') {
    const fields = Object.keys(details.changes);
    if (fields.length > 0) {
      return (
        <div className="mt-2 flex flex-wrap gap-1">
          {fields.map((field) => (
            <span key={field} className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Updated {field.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      );
    }
  }

  return null;
};

const formatFallbackAction = (log: AuditLogEntry): string => {
  return log.action
    .replace(/^blog\./, '')
    .replace(/[\._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};