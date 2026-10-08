import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { formatLocalDateTime, formatRelative } from '../../../shared/utils/dates';
import { getActionStyle } from '../lib/actionStyle';
import { formatChangeValue, getFieldChanges, humanizeField, type EntryLink } from '../lib/entryDetails';
import type { AuditLogEntry, FieldChange } from '../types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  author: 'Author',
  viewer: 'Viewer',
};

const roleLabel = (role: unknown) =>
  typeof role === 'string' ? ROLE_LABELS[role.toLowerCase()] ?? role : String(role ?? 'unknown');

const formatFallbackAction = (action: string) => {
  const words = action.replace(/^blog\./, '').replace(/[._]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

interface ActivityRowProps {
  log: AuditLogEntry;
  /** Absolute path to what the entry is about, when the viewer can open it. */
  link: (EntryLink & { href: string }) | null;
}

export const ActivityRow = ({ log, link }: ActivityRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const { Icon, tone } = getActionStyle(log.action);
  const roleChange = log.details?.changes?.role;
  const changes = roleChange ? [] : getFieldChanges(log);
  const isReader = log.resource_type === 'comment' && log.details?.commenter_role === 'reader';
  const actor = log.actor_name || log.actor_email || 'System';

  return (
    <li className="group">
      <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
        >
          <Icon size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-800 wrap-break-word dark:text-zinc-100">
            {log.description || formatFallbackAction(log.action)}
          </p>

          {roleChange && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <span className="sr-only">Role changed from</span>
              <span className="line-through opacity-70">{roleLabel(roleChange.from)}</span>
              <span aria-hidden="true">→</span>
              <span className="sr-only">to</span>
              <span className="font-semibold">{roleLabel(roleChange.to)}</span>
            </p>
          )}

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span
              className="font-medium text-zinc-700 dark:text-zinc-300"
              title={log.actor_name && log.actor_email ? log.actor_email : undefined}
            >
              {actor}
            </span>
            {isReader && (
              <span className="rounded bg-sky-50 px-1.5 py-px text-[10px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                Reader
              </span>
            )}
            <span aria-hidden="true">·</span>
            <time dateTime={log.created_at} title={formatLocalDateTime(log.created_at)}>
              {formatRelative(log.created_at)}
            </time>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {link && (
            <Link
              to={link.href}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <span className="hidden sm:inline">{link.label}</span>
              <span className="sr-only sm:hidden">{link.label}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
          {changes.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <span className="hidden sm:inline">Changes</span>
              <span className="sr-only sm:hidden">Show changes</span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {changes.length > 0 && expanded && (
        <div id={detailsId} className="pb-3 pl-15 pr-4">
          <ChangeTable changes={changes} />
        </div>
      )}
    </li>
  );
};

const ChangeTable = ({ changes }: { changes: FieldChange[] }) => (
  <dl className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 text-xs dark:divide-zinc-800 dark:border-zinc-800">
    {changes.map((change) => (
      <div key={change.field} className="grid gap-2 bg-white p-3 sm:grid-cols-[9rem_1fr_1fr] dark:bg-zinc-950">
        <dt className="font-medium text-zinc-700 dark:text-zinc-300">{humanizeField(change.field)}</dt>
        <dd className="min-w-0">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Before</span>
          <ChangeValue value={change.from} tone="before" />
        </dd>
        <dd className="min-w-0">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">After</span>
          <ChangeValue value={change.to} tone="after" />
        </dd>
      </div>
    ))}
  </dl>
);

const LONG_VALUE = 160;

const ChangeValue = ({ value, tone }: { value: unknown; tone: 'before' | 'after' }) => {
  const [showAll, setShowAll] = useState(false);
  const text = formatChangeValue(value);

  if (text === null) return <span className="italic text-zinc-400">Empty</span>;

  const isLong = text.length > LONG_VALUE;
  const shown = isLong && !showAll ? `${text.slice(0, LONG_VALUE).trimEnd()}…` : text;
  const color =
    tone === 'before'
      ? 'text-zinc-500 dark:text-zinc-400'
      : 'text-zinc-900 dark:text-zinc-100';

  return (
    <>
      <span className={`block whitespace-pre-wrap wrap-break-word ${color}`}>{shown}</span>
      {isLong && (
        <button
          type="button"
          onClick={() => setShowAll((all) => !all)}
          className="mt-1 text-[11px] font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          {showAll ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
};
