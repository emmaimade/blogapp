import { useState } from 'react';
import { formatChangeValue, humanizeField } from '../lib/entryDetails';
import type { FieldChange } from '../types';

/** Before/after per field, for an audit entry that recorded what changed. */
export const ChangeTable = ({ changes }: { changes: FieldChange[] }) => (
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
