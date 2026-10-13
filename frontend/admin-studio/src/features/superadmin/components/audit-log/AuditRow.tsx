import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, Clock, Copy, Filter, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPreciseDateTime, formatRelative, formatTimeOfDay, formatUtcIso } from '../../../../shared/utils/dates';
import { getActionStyle } from '../../../audit-log/lib/actionStyle';
import { formatChangeValue, getFieldChanges, humanizeField } from '../../../audit-log/lib/entryDetails';
import { ChangeTable } from '../../../audit-log/components/ChangeTable';
import type { PlatformAuditEntry, Severity } from './types';

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
  info: 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700',
};

const SEVERITY_ICON: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  info: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

/** A left edge so critical rows stand out while scrolling. */
const SEVERITY_EDGE: Record<Severity, string> = {
  critical: 'border-l-red-500 dark:border-l-red-500',
  warning: 'border-l-transparent',
  info: 'border-l-transparent',
};

const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' };

/** Keys shown elsewhere in the expanded view, so not repeated as "other details". */
const SHOWN_DETAIL_KEYS = new Set(['changes', 'from', 'to']);

/** `q` is the free-text search, which is how an IP address is filtered. */
export type FilterKey = 'actor' | 'workspace' | 'action' | 'q';

interface AuditRowProps {
  log: PlatformAuditEntry;
  onFilter: (key: FilterKey, value: string) => void;
  /** The entry a shared link points at: opened, scrolled to and highlighted. */
  linked?: boolean;
  /** Switch to everything around this entry: same person (or IP), 15 minutes either side. */
  onShowSurrounding: (log: PlatformAuditEntry) => void;
}

const actorText = (log: PlatformAuditEntry) => log.actor_name || log.actor_email || 'System';
const workspaceText = (log: PlatformAuditEntry) => log.blog_name ?? `Workspace #${log.blog_id}`;

export const AuditRow = ({ log, onFilter, linked = false, onShowSurrounding }: AuditRowProps) => {
  const [expanded, setExpanded] = useState(linked);
  const panelId = useId();
  const rowRef = useRef<HTMLLIElement>(null);
  // Shape from the kind of action; colour from severity, which is what this page sorts by.
  const { Icon } = getActionStyle(log.action);

  useEffect(() => {
    if (linked) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [linked]);

  // The whole row toggles, except clicks on its own controls or when selecting text to copy.
  const handleRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (window.getSelection()?.toString()) return;
    setExpanded((open) => !open);
  };

  const actor = (
    <Filterable
      label={actorText(log)}
      filterLabel={log.actor_user_id ? `Only show activity by ${actorText(log)}` : undefined}
      onFilter={() => onFilter('actor', String(log.actor_user_id))}
    />
  );

  const workspace = log.blog_id ? (
    <Filterable
      label={workspaceText(log)}
      filterLabel={`Only show activity in ${workspaceText(log)}`}
      onFilter={() => onFilter('workspace', String(log.blog_id))}
    />
  ) : (
    <span className="text-zinc-400">Platform-wide</span>
  );

  // Rows are grouped under a day heading, so the time of day is enough here.
  const time = (
    <time dateTime={log.created_at} title={formatPreciseDateTime(log.created_at)} className="tabular-nums">
      {formatTimeOfDay(log.created_at)}
    </time>
  );

  return (
    <li
      ref={rowRef}
      className={`border-l-2 ${SEVERITY_EDGE[log.severity]} ${linked ? 'bg-accent' : ''}`}
    >
      <div
        onClick={handleRowClick}
        className="group grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-x-3 py-3 pl-3.5 pr-4 hover:bg-zinc-50/80 md:grid-cols-[2rem_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_2rem] md:items-center dark:hover:bg-zinc-900/40"
      >
        <span aria-hidden="true" className={`flex h-8 w-8 items-center justify-center rounded-lg ${SEVERITY_ICON[log.severity]}`}>
          <Icon size={15} />
        </span>

        <div className="min-w-0">
          {/* Phones wrap the event name; wider screens keep each row to one line. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-nowrap">
            <Filterable
              label={log.label}
              filterLabel={`Only show "${log.label}" events`}
              onFilter={() => onFilter('action', log.action)}
              wrap
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            />
            {log.severity !== 'info' && (
              <span className={`shrink-0 rounded-full px-2 py-px text-[10px] font-semibold ring-1 ring-inset ${SEVERITY_BADGE[log.severity]}`}>
                {SEVERITY_LABEL[log.severity]}
              </span>
            )}
          </div>
          {log.description && log.description !== log.label && (
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400" title={log.description}>
              {log.description}
            </p>
          )}
          {/* On narrow screens the actor, workspace and time columns fold in here. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500 md:hidden dark:text-zinc-400">
            {actor}
            <span aria-hidden="true">·</span>
            {workspace}
            <span aria-hidden="true">·</span>
            {time}
          </p>
        </div>

        <div className="hidden min-w-0 text-xs text-zinc-600 md:block dark:text-zinc-300">{actor}</div>
        <div className="hidden min-w-0 text-xs text-zinc-600 md:block dark:text-zinc-300">{workspace}</div>
        <div className="hidden whitespace-nowrap text-xs md:block">
          <span className="block font-medium text-zinc-700 dark:text-zinc-200">{time}</span>
          <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">{formatRelative(log.created_at)}</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${expanded ? 'Hide' : 'Show'} details: ${log.label} by ${actorText(log)}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div id={panelId}>
          <ExpandedLog log={log} onFilter={onFilter} onShowSurrounding={onShowSurrounding} />
        </div>
      )}
    </li>
  );
};

/**
 * A name with a filter icon that appears when the row is hovered or the
 * icon is focused. Without `filterLabel` it's plain text.
 */
const Filterable = ({
  label,
  filterLabel,
  onFilter,
  className = '',
  wrap = false,
}: {
  label: string;
  filterLabel?: string;
  onFilter: () => void;
  className?: string;
  /** Let the text wrap instead of cutting it off with an ellipsis. */
  wrap?: boolean;
}) => (
  <span className="inline-flex min-w-0 max-w-full items-center gap-1">
    <span className={`min-w-0 ${wrap ? 'md:truncate' : 'truncate'} ${className}`} title={wrap ? undefined : label}>
      {label}
    </span>
    {filterLabel && (
      <button
        type="button"
        onClick={onFilter}
        aria-label={filterLabel}
        title={filterLabel}
        // Touch screens can't hover, so an invisible icon would be a hidden tap target;
        // there the expanded panel's filter buttons do this job instead.
        className="hidden shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition [@media(hover:hover)]:inline-flex hover:bg-accent hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100"
      >
        <Filter size={12} aria-hidden="true" />
      </button>
    )}
  </span>
);

const copyText = async (value: string, what: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${what}.`);
    return true;
  } catch {
    toast.error(`Couldn't copy the ${what}.`);
    return false;
  }
};

const CopyButton = ({ value, what }: { value: string; what: string }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const handle = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(handle);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => setCopied(await copyText(value, what))}
      aria-label={`Copy ${what}`}
      title={`Copy ${what}`}
      className="ml-1 inline-flex rounded p-0.5 align-middle text-zinc-400 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
};

/** The current view's URL pointing at one entry; the page opens and highlights it. */
const entryLink = (id: number) => {
  const url = new URL(window.location.href);
  url.searchParams.set('entry', String(id));
  return url.toString();
};

/** What "around this time" narrows to, most specific first. */
const surroundingScope = (log: PlatformAuditEntry) =>
  log.actor_user_id ? 'by this person' : log.ip_address ? 'from this IP' : log.blog_id ? 'in this workspace' : 'platform-wide';

const ExpandedLog = ({
  log,
  onFilter,
  onShowSurrounding,
}: Pick<AuditRowProps, 'log' | 'onFilter' | 'onShowSurrounding'>) => {
  const [showRaw, setShowRaw] = useState(false);
  const changes = getFieldChanges(log);
  const otherDetails = Object.entries(log.details ?? {}).filter(([key]) => !SHOWN_DETAIL_KEYS.has(key));

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {log.actor_user_id && (
          <ActionButton onClick={() => onFilter('actor', String(log.actor_user_id))}>
            <Filter size={12} aria-hidden="true" /> Only this person
          </ActionButton>
        )}
        {log.blog_id && (
          <ActionButton onClick={() => onFilter('workspace', String(log.blog_id))}>
            <Filter size={12} aria-hidden="true" /> Only this workspace
          </ActionButton>
        )}
        <ActionButton onClick={() => onFilter('action', log.action)}>
          <Filter size={12} aria-hidden="true" /> Only this event
        </ActionButton>
        {log.ip_address && (
          <ActionButton onClick={() => onFilter('q', log.ip_address!)}>
            <Filter size={12} aria-hidden="true" /> Only this IP
          </ActionButton>
        )}
        <ActionButton
          onClick={() => onShowSurrounding(log)}
          title={`Everything ${surroundingScope(log)}, 15 minutes either side, sign-ins included`}
        >
          <Clock size={12} aria-hidden="true" /> Activity around this time
        </ActionButton>
        <ActionButton onClick={() => copyText(entryLink(log.id), 'link to this entry')}>
          <Link2 size={12} aria-hidden="true" /> Copy link
        </ActionButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <dl className="grid content-start gap-x-4 gap-y-3 text-xs sm:grid-cols-[7rem_minmax(0,1fr)]">
          <Detail label="Who">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{actorText(log)}</span>
            {log.actor_name && log.actor_email && <span className="block text-zinc-500">{log.actor_email}</span>}
            {log.actor_user_id && (
              <Link to={`/admin/platform-users/${log.actor_user_id}`} className={linkClass}>
                Open user #{log.actor_user_id} <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            )}
          </Detail>
          <Detail label="Workspace">
            {log.blog_id ? (
              <>
                <span className="text-zinc-900 dark:text-zinc-100">{workspaceText(log)}</span>
                <Link to={`/admin/blogs/${log.blog_id}`} className={linkClass}>
                  Open workspace #{log.blog_id} <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              </>
            ) : (
              'Platform-wide'
            )}
          </Detail>
          {log.resource_id !== null && (
            <Detail label="Affected">
              {log.resource_label ? `${log.resource_label} · ` : ''}
              <span className="text-zinc-500">{humanizeField(log.resource_type)} #{log.resource_id}</span>
            </Detail>
          )}
          <Detail label="When">
            {formatPreciseDateTime(log.created_at)}
            <span className="block font-mono text-[11px] text-zinc-500">
              {formatUtcIso(log.created_at)}
              <CopyButton value={formatUtcIso(log.created_at)} what="UTC timestamp" />
            </span>
          </Detail>
          <Detail label="IP address">
            <span className="font-mono">{log.ip_address || 'Not recorded'}</span>
            {log.ip_address && <CopyButton value={log.ip_address} what="IP address" />}
          </Detail>
          {log.user_agent && (
            <Detail label="Device">
              <span className="break-all font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{log.user_agent}</span>
            </Detail>
          )}
          <Detail label="Event">
            <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{log.action}</span>
          </Detail>
          <Detail label="Entry ID">
            <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">#{log.id}</span>
            <CopyButton value={String(log.id)} what="entry ID" />
          </Detail>
        </dl>

        <div className="min-w-0 space-y-3">
          {changes.length > 0 && (
            <section aria-label="What changed">
              <h3 className="mb-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">What changed</h3>
              <ChangeTable changes={changes} />
            </section>
          )}
          {otherDetails.length > 0 && (
            <section aria-label="Details">
              <h3 className="mb-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">Details</h3>
              <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950">
                {otherDetails.map(([key, value]) => (
                  <Detail key={key} label={humanizeField(key)}>
                    <span className="whitespace-pre-wrap wrap-break-word">{formatChangeValue(value) ?? '—'}</span>
                  </Detail>
                ))}
              </dl>
            </section>
          )}
          {changes.length === 0 && otherDetails.length === 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No further details were recorded for this event.</p>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowRaw((raw) => !raw)}
              aria-expanded={showRaw}
              className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {showRaw ? 'Hide raw event' : 'Show raw event'}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
                {JSON.stringify(log, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ onClick, title, children }: { onClick: () => void; title?: string; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-primary/40 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
  >
    {children}
  </button>
);

const linkClass =
  'mt-0.5 flex w-fit items-center gap-0.5 font-medium text-violet-600 hover:underline dark:text-violet-400';

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
    <dd className="min-w-0 text-zinc-700 dark:text-zinc-300">{children}</dd>
  </>
);
