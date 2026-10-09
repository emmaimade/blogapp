import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Download, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { ActivityFeedSkeleton } from '../../../shared/ui/Skeleton';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { AuditRow, type FilterKey } from '../components/audit-log/AuditRow';
import { EntityPicker } from '../components/audit-log/EntityPicker';
import {
  CATEGORY_OPTIONS,
  FILTER_KEYS,
  RANGE_OPTIONS,
  readFilters,
  toApiParams,
  type AuditSummary,
  type PlatformAuditEntry,
  type Severity,
} from '../components/audit-log/types';

const PAGE_SIZE = 50;
const numberFormat = new Intl.NumberFormat();

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
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [exporting, setExporting] = useState(false);

  /** Changing any filter goes back to page 1; paging keeps the filters. */
  const updateParams = (changes: Record<string, string>, { replace = false, keepPage = false } = {}) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!keepPage) next.delete('page');
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
    queryKey: ['superadmin-audit-logs', filterKey, page],
    queryFn: async () => {
      const res = await api.get<PlatformAuditEntry[]>('/superadmin/audit-logs', {
        params: { ...toApiParams(filters), skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE },
      });
      return { logs: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) };
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
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = FILTER_KEYS.some((key) => key !== 'logins' && !!filters[key]);
  const isRefreshing = isFetching && !isLoading;

  const goToPage = (next: number) => {
    updateParams({ page: next > 1 ? String(next) : '' }, { keepPage: true });
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
            Every workspace's activity and every superadmin action, for investigating incidents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleExport} disabled={exporting} className={headerButtonClass}>
            <Download size={14} aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export CSV'}
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
                onChange={(e) => updateParams({ from: e.target.value })}
                className={`${controlClass} mt-1 w-auto`}
              />
            </label>
            <label className="text-xs text-zinc-500 dark:text-zinc-400">
              To
              <input
                type="datetime-local"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => updateParams({ to: e.target.value })}
                className={`${controlClass} mt-1 w-auto`}
              />
            </label>
            <p className="pb-2 text-xs text-zinc-400">Your local time.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {filters.action && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                Event: <span className="font-mono">{filters.action}</span>
                <button
                  type="button"
                  onClick={() => updateParams({ action: '' })}
                  aria-label="Clear event filter"
                  className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-800 dark:border-zinc-600"
              />
              Include sign-ins
              {filters.actor && <span className="text-zinc-400">(always, for one person)</span>}
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
      </div>

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
          <span>When</span>
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
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No entries match these filters.</p>
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
            className={`divide-y divide-zinc-100 transition-opacity dark:divide-zinc-800/80 ${
              isRefreshing && isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {logs.map((log) => (
              <AuditRow key={log.id} log={log} onFilter={handleFilter} />
            ))}
          </ul>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Page {numberFormat.format(page)} of {numberFormat.format(pageCount)} · {numberFormat.format(total)}{' '}
              {total === 1 ? 'entry' : 'entries'}
            </p>
            <nav aria-label="Pages" className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isFetching}
                className={pagerButtonClass}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pageCount || isFetching}
                className={pagerButtonClass}
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

const headerButtonClass =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900';

const pagerButtonClass =
  'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800';

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
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${
      pressed
        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
    }`}
  >
    {dot && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />}
    {label}
    <span className={`tabular-nums ${pressed ? 'opacity-80' : 'text-zinc-500 dark:text-zinc-400'}`}>
      {count === undefined ? '–' : numberFormat.format(count)}
    </span>
  </button>
);
