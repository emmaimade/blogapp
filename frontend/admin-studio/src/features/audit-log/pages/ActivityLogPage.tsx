import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { History, RefreshCw, Search, X } from 'lucide-react';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useAuth } from '../../auth/context/AuthContext';
import { canAccess, type AdminCapability } from '../../auth/lib/accessControl';
import { ActivityFeedSkeleton } from '../../../shared/ui/Skeleton';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { workspacePath } from '../../../shared/lib/workspacePaths';
import { planName } from '../../../shared/lib/plans';
import { ActivityRow } from '../components/ActivityRow';
import { getEntryLink } from '../lib/entryDetails';
import type { AuditLogEntry, AuditLogFilters } from '../types';

const PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All activity' },
  { value: 'post', label: 'Posts' },
  { value: 'comment', label: 'Comments' },
  { value: 'blog_member', label: 'Team' },
  { value: 'settings', label: 'Settings' },
  { value: 'tag', label: 'Tags' },
  { value: 'subscription', label: 'Billing' },
];

const RANGE_OPTIONS = [
  { days: 1, label: 'Last 24 hours' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

const controlClass =
  'w-full rounded-lg border border-zinc-200 bg-white py-2 text-sm text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus-visible:ring-zinc-700';

const historyLabel = (days: number) => (days >= 365 ? 'year' : `${days} days`);

const dayLabel = (iso: string, now: Date) => {
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

export const ActivityLogPage = () => {
  useDocumentTitle('Activity log');
  const { user } = useAuth();
  const { activeBlog, activeMembership, activeRole } = useBlog();
  const blogId = activeBlog?.id;

  // Filters live in the URL so refresh, back/forward and shared links keep them.
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const type = searchParams.get('type') ?? 'all';
  const actor = searchParams.get('actor') ?? '';
  const since = searchParams.get('since') ?? '';
  const hasFilters = !!(q || type !== 'all' || actor || since);

  const updateParams = (changes: Record<string, string>, replace = false) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value && value !== 'all') next.set(key, value);
          else next.delete(key);
        });
        return next;
      },
      { replace },
    );

  // The search box types ahead of the URL: debounced so each keystroke isn't
  // a round-trip, and reset when the URL changes underneath it (back button,
  // Clear filters).
  const [searchInput, setSearchInput] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setSearchInput(q);
  }
  useEffect(() => {
    const next = searchInput.trim();
    if (next === q) return;
    const handle = setTimeout(() => updateParams({ q: next }, true), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, q]);

  const { data: filters } = useQuery<AuditLogFilters>({
    queryKey: ['audit-log-filters', blogId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/audit-logs/filters`)).data,
    enabled: !!blogId,
    staleTime: 5 * 60 * 1000,
  });
  const historyDays = filters?.history_days ?? null;

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['audit-logs', blogId, type, actor, since, q],
    queryFn: async ({ pageParam }) => {
      const res = await api.get<AuditLogEntry[]>(`/blogs/${blogId}/audit-logs`, {
        params: {
          skip: pageParam * PAGE_SIZE,
          // One extra row says whether there's another page, without a count query.
          limit: PAGE_SIZE + 1,
          resource_type: type !== 'all' ? type : undefined,
          actor_user_id: actor || undefined,
          since: since ? new Date(Date.now() - Number(since) * DAY_MS).toISOString() : undefined,
          search: q || undefined,
        },
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length > PAGE_SIZE ? allPages.length : undefined),
    placeholderData: keepPreviousData,
    enabled: !!blogId,
  });

  const logs = useMemo(() => {
    // Offsets can shift if new activity lands between pages; drop repeats.
    const seen = new Set<number>();
    return (data?.pages ?? [])
      .flatMap((page) => page.slice(0, PAGE_SIZE))
      .filter((log) => !seen.has(log.id) && !!seen.add(log.id));
  }, [data]);

  const groupedLogs = useMemo(() => {
    const now = new Date();
    const groups: { label: string; entries: AuditLogEntry[] }[] = [];
    // Newest first from the backend, so consecutive runs are the day groups.
    logs.forEach((log) => {
      const label = dayLabel(log.created_at, now);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.entries.push(log);
      else groups.push({ label, entries: [log] });
    });
    return groups;
  }, [logs]);

  const can = (capability: AdminCapability) => canAccess(user, activeMembership, capability);
  const linkFor = (log: AuditLogEntry) => {
    const link = activeBlog ? getEntryLink(log, can) : null;
    return link && activeBlog ? { ...link, href: workspacePath(activeBlog.slug, link.path) } : null;
  };

  const rangeOptions = RANGE_OPTIONS.filter((option) => historyDays === null || option.days < historyDays);
  const actorOptions = filters?.actors ?? [];
  const actorMissing = !!actor && !actorOptions.some((option) => String(option.user_id) === actor);
  const isRefreshing = isFetching && !isFetchingNextPage && !isLoading;

  const clearFilters = () => {
    setSearchInput('');
    updateParams({ q: '', type: '', actor: '', since: '' });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 lg:pb-8">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Activity log</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Who changed what in this workspace, and when.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <RefreshCw size={14} aria-hidden="true" className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
          <span className="sr-only sm:hidden">Refresh activity</span>
        </button>
      </div>

      {/* Filters */}
      <div
        role="search"
        className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,auto)]"
      >
        <div className="relative sm:col-span-3 lg:col-span-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            aria-label="Search activity"
            placeholder="Search by person, post, or setting…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${controlClass} pl-9 pr-3 placeholder:text-zinc-400`}
          />
        </div>

        <select
          aria-label="Type of activity"
          value={type}
          onChange={(e) => updateParams({ type: e.target.value })}
          className={`${controlClass} px-3 lg:w-auto`}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          aria-label="Who"
          value={actor}
          onChange={(e) => updateParams({ actor: e.target.value })}
          className={`${controlClass} px-3 lg:w-auto lg:max-w-52`}
        >
          <option value="">Everyone</option>
          {actorMissing && <option value={actor}>Selected person</option>}
          {actorOptions.map((option) => (
            <option key={option.user_id} value={option.user_id}>
              {option.name || option.email || `User #${option.user_id}`}
            </option>
          ))}
        </select>

        <select
          aria-label="When"
          value={since}
          onChange={(e) => updateParams({ since: e.target.value })}
          className={`${controlClass} px-3 lg:w-auto`}
        >
          <option value="">{historyDays ? `Last ${historyLabel(historyDays)}` : 'All time'}</option>
          {rangeOptions.map((option) => (
            <option key={option.days} value={option.days}>{option.label}</option>
          ))}
        </select>
      </div>

      {(hasFilters || historyDays) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
          {historyDays ? (
            <p className="flex items-center gap-1.5">
              <History size={13} aria-hidden="true" />
              <span>
                {activeMembership?.plan ? `The ${planName(activeMembership.plan)} plan keeps` : 'This workspace keeps'}{' '}
                the last {historyLabel(historyDays)} of activity.
                {activeRole === 'owner' && historyDays < 365 && (
                  <>
                    {' '}
                    <Link
                      to={workspacePath(activeBlog!.slug, '/settings/billing')}
                      className="font-medium text-violet-600 hover:underline dark:text-violet-400"
                    >
                      Upgrade for more history
                    </Link>
                  </>
                )}
              </span>
            </p>
          ) : <span />}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              <X size={13} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="mt-6" aria-busy={isFetching}>
        {isLoading ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <ActivityFeedSkeleton rows={6} />
          </div>
        ) : isError && logs.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Couldn't load activity.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <History size={28} aria-hidden="true" className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            {hasFilters ? (
              <>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No activity matches these filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No activity yet.</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                  Posts, comments, team changes and settings updates will show up here as they happen.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className={`space-y-6 transition-opacity ${isRefreshing && isPlaceholderData ? 'opacity-60' : ''}`}>
            {groupedLogs.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {group.label}
                </h2>
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800/80 dark:border-zinc-800 dark:bg-zinc-950">
                  {group.entries.map((log) => (
                    <ActivityRow key={log.id} log={log} link={linkFor(log)} />
                  ))}
                </ul>
              </section>
            ))}

            <div className="flex justify-center pt-2">
              {hasNextPage ? (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              ) : (
                <p className="text-xs text-zinc-400">
                  {historyDays && !since
                    ? `That's everything from the last ${historyLabel(historyDays)}.`
                    : "That's everything."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
