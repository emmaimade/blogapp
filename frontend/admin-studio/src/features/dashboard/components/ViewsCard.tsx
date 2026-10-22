import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Lock } from 'lucide-react';
import { useAnalytics, STATS_RANGES, type StatsRange } from '../hooks/useAnalytics';
import { usePlanAccess } from '../../billing/hooks/usePlanAccess';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { isPlanUpgradeError } from '../../../shared/lib/apiErrors';
import { ViewsChart } from './ViewsChart';
import { bucketDays } from '../lib/bucketDays';

// Mirrors stats_history_days in backend/app/core/plans.py.
const FREE_HISTORY_DAYS = 30;

const Figure = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
    <div className="mt-1 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{value.toLocaleString()}</div>
  </div>
);

export const ViewsCard = ({ isAuthorOnly }: { isAuthorOnly: boolean }) => {
  const toWorkspace = useWorkspacePath();
  const { isPaid } = usePlanAccess();
  const [range, setRange] = React.useState<StatsRange>('30d');
  const { data, isLoading, error } = useAnalytics(range);

  const buckets = React.useMemo(() => (data ? bucketDays(data.days, data.range) : []), [data]);

  return (
    <div className="admin-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            {isAuthorOnly ? 'Views on your posts' : 'Views'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Readers only — your team's visits aren't counted.</p>
        </div>
        <div className="flex w-full rounded-xl bg-zinc-100 p-1 sm:w-auto dark:bg-zinc-800" role="tablist" aria-label="Time range">
          {STATS_RANGES.map(({ key, label, days }) => {
            const locked = !isPaid && days > FREE_HISTORY_DAYS;
            const selected = range === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={locked}
                title={locked ? 'Available on Pro and Team' : undefined}
                onClick={() => setRange(key)}
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
      </div>

      {!isPaid && (
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Free includes 30 days of stats.{' '}
          <Link to={toWorkspace('/settings/billing')} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
            Upgrade
          </Link>{' '}
          to see up to 12 months.
        </p>
      )}

      {isLoading && <div className="h-[244px] animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />}

      {error && !data && (
        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {isPlanUpgradeError(error) ? 'This range isn’t included in your plan.' : 'Couldn’t load view stats.'}
        </p>
      )}

      {data && (
        <>
          <div className="mb-4 flex gap-8">
            <Figure label="Views" value={data.total_views} />
            {data.total_visitors !== null && <Figure label="Visitors" value={data.total_visitors} />}
          </div>

          {data.total_views > 0 ? (
            <ViewsChart buckets={buckets} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                <Eye size={22} className="text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No views in this period yet</p>
              <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                Views show up here as readers open your posts.
              </p>
            </div>
          )}

          {data.top_posts.length > 0 && (
            <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Top posts</h4>
              <ol className="space-y-1">
                {data.top_posts.map((post) => (
                  <li key={post.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to={toWorkspace(`/posts/view/${post.id}`)}
                      className="min-w-0 truncate font-medium text-zinc-700 hover:text-violet-600 dark:text-zinc-300 dark:hover:text-violet-400"
                    >
                      {post.title}
                    </Link>
                    <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {post.views.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
};
