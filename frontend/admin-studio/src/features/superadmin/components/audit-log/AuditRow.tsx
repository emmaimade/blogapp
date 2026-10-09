import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { formatLocalDateTime, formatRelative } from '../../../../shared/utils/dates';
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

const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' };

/** Keys shown elsewhere in the expanded view, so not repeated as "other details". */
const SHOWN_DETAIL_KEYS = new Set(['changes', 'from', 'to']);

export type FilterKey = 'actor' | 'workspace' | 'action';

interface AuditRowProps {
  log: PlatformAuditEntry;
  onFilter: (key: FilterKey, value: string) => void;
}

const actorText = (log: PlatformAuditEntry) => log.actor_name || log.actor_email || 'System';

export const AuditRow = ({ log, onFilter }: AuditRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  // Shape from the kind of action; colour from severity, which is what this page sorts by.
  const { Icon } = getActionStyle(log.action);

  const actorButton = log.actor_user_id ? (
    <FilterButton onClick={() => onFilter('actor', String(log.actor_user_id))} title={`Only show activity by ${actorText(log)}`}>
      {actorText(log)}
    </FilterButton>
  ) : (
    <span>{actorText(log)}</span>
  );

  const workspaceButton = log.blog_id ? (
    <FilterButton
      onClick={() => onFilter('workspace', String(log.blog_id))}
      title={`Only show activity in ${log.blog_name ?? `workspace #${log.blog_id}`}`}
    >
      {log.blog_name ?? `Workspace #${log.blog_id}`}
    </FilterButton>
  ) : (
    <span className="text-zinc-400">Platform</span>
  );

  const time = (
    <time dateTime={log.created_at} title={formatLocalDateTime(log.created_at)}>
      {formatRelative(log.created_at)}
    </time>
  );

  return (
    <li>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-x-3 px-4 py-3 md:grid-cols-[2rem_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_2rem] md:items-center">
        <span aria-hidden="true" className={`flex h-8 w-8 items-center justify-center rounded-lg ${SEVERITY_ICON[log.severity]}`}>
          <Icon size={15} />
        </span>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FilterButton
              onClick={() => onFilter('action', log.action)}
              title={`Only show "${log.label}" events`}
              className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {log.label}
            </FilterButton>
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
            {actorButton}
            <span aria-hidden="true">·</span>
            {workspaceButton}
            <span aria-hidden="true">·</span>
            {time}
          </p>
        </div>

        <div className="hidden min-w-0 truncate text-xs text-zinc-600 md:block dark:text-zinc-300">{actorButton}</div>
        <div className="hidden min-w-0 truncate text-xs text-zinc-600 md:block dark:text-zinc-300">{workspaceButton}</div>
        <div className="hidden whitespace-nowrap text-xs text-zinc-500 md:block dark:text-zinc-400">{time}</div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? 'Hide details' : 'Show details'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div id={panelId}>
          <ExpandedLog log={log} />
        </div>
      )}
    </li>
  );
};

const FilterButton = ({
  onClick,
  title,
  className = '',
  children,
}: {
  onClick: () => void;
  title: string;
  className?: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`max-w-full truncate text-left underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${className}`}
  >
    {children}
  </button>
);

const ExpandedLog = ({ log }: { log: PlatformAuditEntry }) => {
  const [showRaw, setShowRaw] = useState(false);
  const changes = getFieldChanges(log);
  const otherDetails = Object.entries(log.details ?? {}).filter(([key]) => !SHOWN_DETAIL_KEYS.has(key));

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/30">
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
                <span className="text-zinc-900 dark:text-zinc-100">{log.blog_name ?? `Workspace #${log.blog_id}`}</span>
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
            {formatLocalDateTime(log.created_at)}
            <span className="block font-mono text-[11px] text-zinc-500">{new Date(log.created_at).toISOString()}</span>
          </Detail>
          <Detail label="IP address">
            <span className="font-mono">{log.ip_address || 'Not recorded'}</span>
          </Detail>
          {log.user_agent && (
            <Detail label="Device">
              <span className="break-all font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{log.user_agent}</span>
            </Detail>
          )}
          <Detail label="Event">
            <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{log.action}</span>
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

const linkClass =
  'mt-0.5 inline-flex items-center gap-0.5 font-medium text-violet-600 hover:underline dark:text-violet-400';

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
    <dd className="min-w-0 text-zinc-700 dark:text-zinc-300">{children}</dd>
  </>
);
