// Where readers come from: a ranked bar list, one hue (it's one measure, so
// no legend), the number and share as text beside each bar. Past the top
// eight, sources fold into "Other" rather than growing the list.

const TOP = 8;

/** Whole percent, with "<1%" for small but real shares rather than a misleading 0%. */
const share = (visits: number, total: number) => {
  const percent = (visits / total) * 100;
  return percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`;
};

export const SourcesList = ({ sources }: { sources: { source: string; visits: number }[] }) => {
  const total = sources.reduce((sum, s) => sum + s.visits, 0);
  const shown = sources.slice(0, TOP);
  const rest = sources.slice(TOP).reduce((sum, s) => sum + s.visits, 0);
  const rows = rest > 0 ? [...shown, { source: 'Other', visits: rest }] : shown;
  const peak = Math.max(...rows.map((r) => r.visits), 1);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No visits yet in this period. Sources show up as readers arrive.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map(({ source, visits }) => (
        <li key={source}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{source}</span>
            <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-white">{visits.toLocaleString()}</span>
              {' · '}
              {share(visits, total)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-2 rounded-full bg-violet-600 dark:bg-violet-500" style={{ width: `${(visits / peak) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
