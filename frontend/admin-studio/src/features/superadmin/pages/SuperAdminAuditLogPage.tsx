import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { ActivityFeedSkeleton } from '../../../shared/ui/Skeleton';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import {
  formatDayHeading,
  formatPreciseDateTime,
  localDayKey,
  localTimeZoneLabel,
  toDateTimeLocalValue,
} from '../../../shared/utils/dates';
import { AuditPager } from '../components/audit-log/AuditPager';
import { AuditRow, type FilterKey } from '../components/audit-log/AuditRow';
import { EntityPicker } from '../components/audit-log/EntityPicker';
import {
  CATEGORY_OPTIONS,
  FILTER_KEYS,
  localToIso,
  RANGE_OPTIONS,
  readFilters,
  toApiParams,
  type AuditSummary,
  type PlatformAuditEntry,
  type Severity,
} from '../components/audit-log/types';

const PAGE_SIZE = 50;
/** The export endpoint's cap; it sets x-export-truncated past this. */
const EXPORT_LIMIT = 10_000;
const numberFormat = new Intl.NumberFormat();
const timeZoneLabel = localTimeZoneLabel();

const controlClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus-visible:ring-zinc-700';

const SEVERITY_CHIPS: { value: Severity; label: string; dot: string }[] = [
  { value: 'critical', label: 'Critical', dot: 'bg-red-500' },
  { value: 'warning', label: 'Warning', dot: 'bg-amber-500' },
  { value: 'info', label: 'Info', dot: 'bg-zinc-400' },
];

export const SuperAdminAuditLogPage = () => {
  useDocumentTitle('Platform audit log');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  // Cursor paging: `before` shows the entries just older than that id, `after` the ones just newer,
  // and `at` (a datetime-local value) the ones at or before that moment.
  const before = searchParams.get('before') ?? '';
  const after = searchParams.get('after') ?? '';
  const at = searchParams.get('at') ?? '';
  const onNewestPage = !before && !after && !at;
  /** An entry a shared link points at (`?entry=<id>`). */
  const linkedEntry = Number(searchParams.get('entry')) || 0;
  const [exporting, setExporting] = useState(false);

  /**
   * Changing any filter goes back to the newest page; paging keeps the
   * filters. Either drops a linked entry unless `changes` sets a new one.
   */
  const updateParams = (changes: Record<string, string>, { replace = false, keepPage = false } = {}) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('entry');
        next.delete('page'); // from before cursor paging; old links still open
        if (!keepPage) {
          next.delete('before');
          next.delete('after');
          next.delete('at');
        }
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      },
      { replace },
    );

  // Search types ahead of the URL; see ActivityLogPage for the same pattern.
  const [searchInput, setSearchInput] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setSearchInput(filters.q);
  }
  useEffect(() => {
    const next = searchInput.trim();
    if (next === filters.q) return;
    const handle = setTimeout(() => updateParams({ q: next }, { replace: true }), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, filters.q]);

  const filterKey = JSON.stringify(filters);

  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ['superadmin-audit-logs', filterKey, before, after, at],
    queryFn: async () => {
      const res = await api.get<PlatformAuditEntry[]>('/superadmin/audit-logs', {
        params: {
          ...toApiParams(filters),
          before_id: before || undefined,
          after_id: after || undefined,
          at: localToIso(at),
          limit: PAGE_SIZE,
        },
      });
      return {
        logs: res.data,
        total: Number(res.headers['x-total-count'] ?? res.data.length),
        hasOlder: res.headers['x-has-older'] === 'true',
        hasNewer: res.headers['x-has-newer'] === 'true',
      };
    },
    placeholderData: keepPreviousData,
  });

  // The summary ignores the severity filter, so it isn't part of the key.
  const { data: summary, refetch: refetchSummary } = useQuery<AuditSummary>({
    queryKey: ['superadmin-audit-summary', JSON.stringify({ ...filters, severity: '' })],
    queryFn: async () => (await api.get('/superadmin/audit-logs/summary', { params: toApiParams(filters) })).data,
    placeholderData: keepPreviousData,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const hasOlder = data?.hasOlder ?? false;
  const hasNewer = data?.hasNewer ?? false;
  const hasFilters = FILTER_KEYS.some((key) => key !== 'logins' && !!filters[key]);
  // datetime-local values compare correctly as strings.
  const rangeIsBackwards = filters.range === 'custom' && !!filters.from && !!filters.to && filters.to < filters.from;
  const isRefreshing = isFetching && !isLoading;
  // Filtering by one person always includes their sign-ins.
  const signInsHidden = !filters.logins && !filters.actor;
  const showSignIns = () => updateParams({ logins: '1' });

  // Newest first, so consecutive rows on the same local day share a heading.
  const dayGroups = useMemo(() => {
    const groups: { key: string; heading: string; logs: PlatformAuditEntry[] }[] = [];
    for (const log of data?.logs ?? []) {
      const key = localDayKey(log.created_at);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.logs.push(log);
      else groups.push({ key, heading: formatDayHeading(log.created_at), logs: [log] });
    }
    return groups;
  }, [data?.logs]);

  const goToPage = (cursor: { before?: number; after?: number }) => {
    updateParams(
      { before: cursor.before ? String(cursor.before) : '', after: cursor.after ? String(cursor.after) : '', at: '' },
      { keepPage: true },
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpTo = (localValue: string) => {
    updateParams({ at: localValue, before: '', after: '' }, { keepPage: true });
  };

  const entriesWord = total === 1 ? 'entry' : 'entries';
  const pagerProps = {
    status: at
      ? `From ${formatPreciseDateTime(localToIso(at))} and older · ${numberFormat.format(total)} ${entriesWord} in all`
      : `${onNewestPage ? 'Newest' : 'Showing'} ${numberFormat.format(logs.length)} of ${numberFormat.format(total)} ${entriesWord}`,
    onNewestPage,
    hasNewer,
    hasOlder,
    disabled: isFetching,
    onNewest: () => goToPage({}),
    onNewer: () => goToPage({ after: logs[0]?.id }),
    onOlder: () => goToPage({ before: logs[logs.length - 1]?.id }),
    jumpedTo: at,
    onJump: jumpTo,
  };

  // Paging newer until nothing is newer leaves a short page under an `after`
  // cursor; that page is the newest one, so show it in full.
  useEffect(() => {
    if (after && data && !isPlaceholderData && !data.hasNewer) updateParams({ after: '' }, { replace: true, keepPage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [after, data, isPlaceholderData]);

  // A shared entry that isn't in the current results is fetched on its own and pinned above them.
  const linkedOnPage = logs.some((log) => log.id === linkedEntry);
  const linkedQuery = useQuery({
    queryKey: ['superadmin-audit-log', linkedEntry],
    queryFn: async () => (await api.get<PlatformAuditEntry>(`/superadmin/audit-logs/${linkedEntry}`)).data,
    enabled: !!linkedEntry && !!data && !isPlaceholderData && !linkedOnPage,
    retry: false,
    staleTime: Infinity,
  });
  const showPinnedEntry = !!linkedEntry && !!data && !isPlaceholderData && !linkedOnPage;
  const dismissLinkedEntry = () => updateParams({}, { replace: true, keepPage: true });

  /** Everything around one entry: same person (else IP, else workspace), 15 minutes either side. */
  const showSurrounding = (log: PlatformAuditEntry) => {
    const scope: Record<string, string> = log.actor_user_id
      ? { actor: String(log.actor_user_id) }
      : log.ip_address
        ? { q: log.ip_address }
        : log.blog_id
          ? { workspace: String(log.blog_id) }
          : {};
    updateParams({
      ...Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])),
      ...scope,
      logins: '1',
      range: 'custom',
      from: toDateTimeLocalValue(log.created_at, -15),
      // The input is minute-precision and `until` is exclusive, so one more minute keeps the full window.
      to: toDateTimeLocalValue(log.created_at, 16),
      entry: String(log.id),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilter = (key: FilterKey, value: string) => updateParams({ [key]: value });

  const clearFilters = () => {
    setSearchInput('');
    updateParams(Object.fromEntries(FILTER_KEYS.filter((key) => key !== 'logins').map((key) => [key, ''])));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/superadmin/audit-logs/export', { params: toApiParams(filters), responseType: 'blob' });
      const disposition = String(res.headers['content-disposition'] ?? '');
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'platform-audit-log.csv';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      if (res.headers['x-export-truncated'] === 'true') {
        toast('Exported the newest 10,000 entries. Narrow the filters to export the rest.', { icon: '⚠️' });
      } else {
        toast.success('Export downloaded.');
      }
    } catch {
      toast.error("Couldn't export the audit log. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Platform audit log</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Workspace activity and superadmin actions across the platform, for investigating incidents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || (!isLoading && total === 0)}
            className={headerButtonClass}
          >
            <Download size={14} aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export CSV'}
            {!exporting && total > 0 && (
              <span className="tabular-nums font-normal text-zinc-400">
                {numberFormat.format(Math.min(total, EXPORT_LIMIT))}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchSummary();
            }}
            disabled={isFetching}
            className={headerButtonClass}
          >
            <RefreshCw size={14} aria-hidden="true" className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sr-only sm:hidden">Refresh audit log</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div role="search" className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              aria-label="Search the audit log"
              placeholder="Search email, IP address, event, details…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`${controlClass} pl-9 placeholder:text-zinc-400`}
            />
          </div>
          <EntityPicker kind="user" value={filters.actor} onChange={(id) => updateParams({ actor: id })} />
          <EntityPicker kind="workspace" value={filters.workspace} onChange={(id) => updateParams({ workspace: id })} />
          <select
            aria-label="Category"
            value={filters.category}
            onChange={(e) => updateParams({ category: e.target.value })}
            className={controlClass}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="Time range"
            value={filters.range}
            onChange={(e) => updateParams({ range: e.target.value, from: '', to: '' })}
            className={controlClass}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {filters.range === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">
              From
              <input
                type="datetime-local"
                value={filters.from}
                onChange={(e) => updateParams({ from: e.target.value }, { replace: true })}
                className={`${controlClass} mt-1 w-auto`}
              />
            </label>
            <label className="text-xs text-zinc-500 dark:text-zinc-400">
              To
              <input
                type="datetime-local"
                value={filters.to}
                min={filters.from || undefined}
                aria-invalid={rangeIsBackwards || undefined}
                onChange={(e) => updateParams({ to: e.target.value }, { replace: true })}
                className={`${controlClass} mt-1 w-auto`}
              />
            </label>
            {rangeIsBackwards ? (
              <p role="alert" className="pb-2 text-xs font-medium text-red-600 dark:text-red-400">
                "To" is before "From", so nothing can match.
              </p>
            ) : (
              <p className="pb-2 text-xs text-zinc-400">Your local time.</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {filters.action && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-2.5 pr-1 text-xs font-medium text-accent-text">
                Event: <span className="font-mono">{filters.action}</span>
                <button
                  type="button"
                  onClick={() => updateParams({ action: '' })}
                  aria-label="Clear event filter"
                  className="rounded-full p-0.5 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={filters.logins || !!filters.actor}
                disabled={!!filters.actor}
                onChange={(e) => updateParams({ logins: e.target.checked ? '1' : '' })}
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-primary dark:border-zinc-600"
              />
              Include sign-ins
              {filters.actor && <span className="text-zinc-400">Included when filtering by a person</span>}
            </label>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              <X size={13} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Severity counts double as the severity filter */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by severity">
        <SeverityChip
          label="All"
          count={summary?.total}
          pressed={!filters.severity}
          onClick={() => updateParams({ severity: '' })}
        />
        {SEVERITY_CHIPS.map((chip) => (
          <SeverityChip
            key={chip.value}
            label={chip.label}
            dot={chip.dot}
            count={summary?.by_severity[chip.value]}
            pressed={filters.severity === chip.value}
            onClick={() => updateParams({ severity: filters.severity === chip.value ? '' : chip.value })}
          />
        ))}
        {signInsHidden && (
          <p className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            Sign-ins are hidden.{' '}
            <button type="button" onClick={showSignIns} className={inlineLinkClass}>
              Show them
            </button>
          </p>
        )}
      </div>

      {showPinnedEntry && (linkedQuery.data || linkedQuery.isError) && (
        <section
          aria-label="Linked entry"
          className="overflow-hidden rounded-xl border border-primary/40 bg-white dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 bg-accent px-4 py-2">
            <p className="text-xs font-medium text-accent-text">
              {linkedQuery.data
                ? 'Linked entry · not in the current results'
                : `Couldn't load entry #${linkedEntry}. It may have been removed.`}
            </p>
            <button type="button" onClick={dismissLinkedEntry} className={inlineLinkClass + ' text-xs'}>
              Dismiss
            </button>
          </div>
          {linkedQuery.data && (
            <ul>
              <AuditRow log={linkedQuery.data} onFilter={handleFilter} onShowSurrounding={showSurrounding} linked />
            </ul>
          )}
        </section>
      )}

      {isError && logs.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle size={15} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1">
            Couldn't refresh the audit log. These are earlier results and may not match your filters.
          </span>
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchSummary();
            }}
            disabled={isFetching}
            className="text-sm font-semibold underline-offset-2 hover:underline disabled:opacity-50"
          >
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      )}

      {total > 0 && <AuditPager {...pagerProps} placement="top" />}

      {/* Log */}
      <div
        aria-busy={isFetching}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="hidden grid-cols-[2rem_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_2rem] gap-x-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-500 md:grid dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
          <span />
          <span>Event</span>
          <span>Who</span>
          <span>Workspace</span>
          <span>When{timeZoneLabel && <span className="font-normal text-zinc-400"> ({timeZoneLabel})</span>}</span>
          <span />
        </div>

        {isLoading ? (
          <ActivityFeedSkeleton rows={8} />
        ) : isError && logs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Couldn't load the audit log.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ShieldCheck size={28} aria-hidden="true" className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {hasFilters ? 'No entries match these filters.' : 'No activity has been recorded yet.'}
            </p>
            {signInsHidden && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Sign-ins aren't included.{' '}
                <button type="button" onClick={showSignIns} className={inlineLinkClass}>
                  Include them
                </button>
              </p>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul
            className={`divide-y divide-zinc-200 transition-opacity dark:divide-zinc-800 ${
              isRefreshing && isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {dayGroups.map((group) => (
              <li key={group.key}>
                <h2 className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:text-zinc-400">
                  {group.heading}
                </h2>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {group.logs.map((log) => (
                    <AuditRow
                      key={log.id}
                      log={log}
                      onFilter={handleFilter}
                      onShowSurrounding={showSurrounding}
                      linked={log.id === linkedEntry}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {total > 0 && (
          <AuditPager
            {...pagerProps}
            placement="bottom"
            className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          />
        )}
      </div>
    </div>
  );
};

const headerButtonClass =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900';

const inlineLinkClass =
  'font-medium text-primary underline-offset-2 hover:text-primary-hover hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

const SeverityChip = ({
  label,
  count,
  pressed,
  onClick,
  dot,
}: {
  label: string;
  count: number | undefined;
  pressed: boolean;
  onClick: () => void;
  dot?: string;
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-950 ${
      pressed
        ? 'border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover'
        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
    }`}
  >
    {dot && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot} ${pressed ? 'ring-2 ring-white/80' : ''}`} />}
    {label}
    <span className={`tabular-nums ${pressed ? 'opacity-80' : 'text-zinc-500 dark:text-zinc-400'}`}>
      {count === undefined ? '–' : numberFormat.format(count)}
    </span>
  </button>
);
