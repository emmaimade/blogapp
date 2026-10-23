import { Lock } from 'lucide-react';
import { FREE_HISTORY_DAYS, STATS_RANGES, type StatsRange } from '../hooks/useAnalytics';
import { usePlanAccess } from '../../billing/hooks/usePlanAccess';

/** 7 days / 30 days / 90 days / 12 months; ranges past Free's history are locked on Free. */
export const RangePicker = ({ value, onChange }: { value: StatsRange; onChange: (range: StatsRange) => void }) => {
  const { isPaid } = usePlanAccess();
  return (
    <div className="flex w-full rounded-xl bg-zinc-100 p-1 sm:w-auto dark:bg-zinc-800" role="tablist" aria-label="Time range">
      {STATS_RANGES.map(({ key, label, days }) => {
        const locked = !isPaid && days > FREE_HISTORY_DAYS;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={locked}
            title={locked ? 'Available on Pro and Team' : undefined}
            onClick={() => onChange(key)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition sm:flex-none ${
              selected
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {locked && <Lock size={10} />}
            {label}
          </button>
        );
      })}
    </div>
  );
};
