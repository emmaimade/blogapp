import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Download, Lock } from 'lucide-react';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { formatLocalDate } from '../../../shared/utils/dates';
import { isPlanUpgradeError } from '../../../shared/lib/apiErrors';
import type { StatsRange } from '../../dashboard/hooks/useAnalytics';
import { RangePicker } from '../../dashboard/components/RangePicker';
import { ViewsChart } from '../../dashboard/components/ViewsChart';
import { bucketDays, groupDays } from '../../dashboard/lib/bucketDays';
import { FollowersChart } from '../components/FollowersChart';
import { SourcesList } from '../components/SourcesList';
import {
  POSTS_PAGE_SIZE,
  useAnalyticsOverview,
  useExportAnalytics,
  usePostAnalytics,
  type AnalyticsTotals,
  type PostSort,
} from '../hooks/useAnalyticsPage';

const HEADLINES: { key: keyof AnalyticsTotals; label: string; upIsGood: boolean }[] = [
  { key: 'views', label: 'Views', upIsGood: true },
  { key: 'visitors', label: 'Visitors', upIsGood: true },
  { key: 'new_followers', label: 'New followers', upIsGood: true },
  { key: 'unsubscribes', label: 'Unsubscribed', upIsGood: false },
];

const SORTS: { key: PostSort; label: string }[] = [
  { key: 'views', label: 'Most read' },
  { key: 'followers', label: 'Most followers' },
  { key: 'newest', label: 'Newest' },
];

/** "↑ 12%" against the previous period, green when the change is good news. */
const Change = ({ now, before, upIsGood }: { now: number; before: number; upIsGood: boolean }) => {
  if (before === 0) {
    return now > 0 ? <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">New this period</span> : null;
  }
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No change</span>;
  const up = change > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      <Icon size={14} aria-hidden="true" />
      {Math.abs(change)}%<span className="sr-only">{up ? ' up' : ' down'}</span>
      <span className="ml-1 font-medium text-zinc-500 dark:text-zinc-400">vs previous</span>
    </span>
  );
};

const Card = ({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <section className={`admin-card min-w-0 p-5 ${className}`}>
    <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{title}</h2>
    {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

export const AnalyticsPage = () => {
  useDocumentTitle('Analytics');
  const toWorkspace = useWorkspacePath();
  const [range, setRange] = React.useState<StatsRange>('30d');
  const [sort, setSort] = React.useState<PostSort>('views');
  const [page, setPage] = React.useState(0);

  const { data: overview, isLoading, error } = useAnalyticsOverview(range);
  const { data: posts } = usePostAnalytics(range, sort, page);
  const exportCsv = useExportAnalytics();

  const viewBuckets = React.useMemo(() => (overview ? bucketDays(overview.days, overview.range) : []), [overview]);
  const followerGroups = React.useMemo(() => (overview ? groupDays(overview.days, overview.range) : []), [overview]);

  const changeRange = (next: StatsRange) => {
    setRange(next);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Readers, followers and where they come from. Your team's visits aren't counted.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <RangePicker value={range} onChange={changeRange} />
          {overview && (overview.can_export ? (
            <button
              type="button"
              onClick={() => exportCsv.mutate(range)}
              disabled={exportCsv.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 sm:w-auto transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Download size={16} /> {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
            </button>
          ) : (
            <Link
              to={toWorkspace('/settings/billing')}
              title="Exporting analytics is available on Pro and Team"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-2 sm:w-auto text-sm font-semibold text-zinc-500 transition hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-violet-400"
            >
              <Lock size={14} /> Export CSV · Pro
            </Link>
          ))}
        </div>
      </div>

      {isLoading && <div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />}

      {error && !overview && (
        <p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {isPlanUpgradeError(error) ? 'This range isn’t included in your plan.' : 'Couldn’t load analytics.'}
        </p>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {HEADLINES.map(({ key, label, upIsGood }) => (
              <div key={key} className="admin-card flex min-w-0 flex-col gap-2 p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
                <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {overview.totals[key].toLocaleString()}
                </span>
                {overview.previous_totals && (
                  <Change now={overview.totals[key]} before={overview.previous_totals[key]} upIsGood={upIsGood} />
                )}
              </div>
            ))}
          </div>

          <Card title="Views and visitors">
            {overview.totals.views > 0 ? (
              <ViewsChart buckets={viewBuckets} />
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No views in this period yet.</p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card title="Followers" subtitle="Confirmed follows and unsubscribes" className="lg:col-span-3">
              {overview.totals.new_followers + overview.totals.unsubscribes > 0 ? (
                <FollowersChart groups={followerGroups} />
              ) : (
                <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No follower changes in this period yet.
                </p>
              )}
            </Card>
            <Card title="Where readers come from" subtitle="By visit, from the first page they open" className="lg:col-span-2">
              <SourcesList sources={overview.sources} />
            </Card>
          </div>

          {overview.follower_posts.length > 0 && (
            <Card title="Posts that brought followers" subtitle="Where new followers signed up in this period">
              <ol className="space-y-1.5">
                {overview.follower_posts.map((post) => (
                  <li key={post.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to={toWorkspace(`/posts/view/${post.id}`)}
                      className="min-w-0 truncate font-medium text-zinc-700 hover:text-violet-600 dark:text-zinc-300 dark:hover:text-violet-400"
                    >
                      {post.title}
                    </Link>
                    <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-white">
                      +{post.followers.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <section className="admin-card min-w-0 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Posts</h2>
              <div className="grid w-full grid-cols-3 rounded-xl bg-zinc-100 p-1 sm:flex sm:w-auto dark:bg-zinc-800" role="tablist" aria-label="Sort posts">
                {SORTS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={sort === key}
                    onClick={() => {
                      setSort(key);
                      setPage(0);
                    }}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:py-1 ${
                      sort === key
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {posts && posts.items.length === 0 && (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No published posts yet.</p>
            )}

            {/* Phones: one card per post, the numbers under the title, rather than a table to scroll sideways. */}
            {posts && posts.items.length > 0 && (
              <ul className="divide-y divide-zinc-100 sm:hidden dark:divide-zinc-800">
                {posts.items.map((post) => (
                  <li key={post.id} className="px-5 py-3">
                    <Link
                      to={toWorkspace(`/posts/view/${post.id}`)}
                      className="line-clamp-2 text-sm font-medium text-zinc-800 hover:text-violet-600 dark:text-zinc-200 dark:hover:text-violet-400"
                    >
                      {post.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{formatLocalDate(post.published_at)}</p>
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      <span><span className="font-semibold text-zinc-900 dark:text-white">{post.views_in_range.toLocaleString()}</span> views</span>
                      {post.followers_gained > 0 && (
                        <span><span className="font-semibold text-zinc-900 dark:text-white">+{post.followers_gained.toLocaleString()}</span> follower{post.followers_gained === 1 ? '' : 's'}</span>
                      )}
                      <span>{post.lifetime_views.toLocaleString()} all time</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {posts && posts.items.length > 0 && (
              <div className="hidden sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th scope="col" className="w-full px-5 py-2.5">Post</th>
                      <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right">Views</th>
                      <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right">Followers</th>
                      <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right">All time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {posts.items.map((post) => (
                      <tr key={post.id}>
                        <td className="w-full max-w-0 px-5 py-3">
                          <Link
                            to={toWorkspace(`/posts/view/${post.id}`)}
                            className="block truncate font-medium text-zinc-800 hover:text-violet-600 dark:text-zinc-200 dark:hover:text-violet-400"
                          >
                            {post.title}
                          </Link>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatLocalDate(post.published_at)}</span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-900 dark:text-white">
                          {post.views_in_range.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {post.followers_gained > 0 ? `+${post.followers_gained.toLocaleString()}` : '–'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {post.lifetime_views.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {posts && posts.total > POSTS_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <span>
                  {page * POSTS_PAGE_SIZE + 1}–{page * POSTS_PAGE_SIZE + posts.items.length} of {posts.total.toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
                    Previous
                  </button>
                  <button type="button" disabled={!posts.has_more} onClick={() => setPage(page + 1)} className="rounded-lg px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
