import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock, Download, Mail, Search, Trash2, UserCheck, UserMinus } from 'lucide-react';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useBlog } from '../../../app/providers/BlogProvider';
import { formatLocalDate } from '../../../shared/utils/dates';
import { Modal } from '../../../shared/components/Modal';
import {
  PAGE_SIZE,
  useAudienceActions,
  useFollowers,
  useFollowerSummary,
  type Follower,
  type FollowerStatus,
} from '../hooks/useAudience';
import { RecommendationsTab } from '../components/RecommendationsTab';

const TABS: { key: FollowerStatus | 'all'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'all', label: 'All' },
];

const STATUS_STYLE: Record<FollowerStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  unsubscribed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const SummaryCard = ({ label, value, sub, icon }: { label: string; value: number; sub?: React.ReactNode; icon: React.ReactNode }) => (
  <div className="admin-card flex min-w-0 flex-col gap-3 p-5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{icon}</span>
    </div>
    <div className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{value.toLocaleString()}</div>
    {sub && <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{sub}</div>}
  </div>
);

export const AudiencePage = () => {
  useDocumentTitle('Audience');
  const toWorkspace = useWorkspacePath();
  const { activeMembership } = useBlog();
  const isOwner = activeMembership?.role === 'owner';
  const [section, setSection] = React.useState<'followers' | 'recommendations'>('followers');

  const [tab, setTab] = React.useState<FollowerStatus | 'all'>('active');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [toRemove, setToRemove] = React.useState<Follower | null>(null);

  // Search as you type, without a request per keystroke.
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data: summary } = useFollowerSummary();
  const { data: list, isLoading } = useFollowers(tab, query, page);
  const { remove, setEnabled, exportCsv } = useAudienceActions();

  const countFor = (key: FollowerStatus | 'all') =>
    !summary ? 0 : key === 'all' ? summary.active + summary.pending + summary.unsubscribed : summary[key];

  const limit = summary?.max_followers ?? null;
  const usage = summary && limit ? summary.active / limit : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Audience</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Readers who follow your blog by email.
          </p>
        </div>
        {section === 'followers' && summary?.can_export && (
          <button
            type="button"
            onClick={() => exportCsv.mutate(tab)}
            disabled={exportCsv.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download size={16} /> {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>

      {/* Recommendations are the owner's; editors see followers only. */}
      {isOwner && (
        <div className="grid w-full grid-cols-2 rounded-xl bg-zinc-100 p-1 sm:inline-flex sm:w-auto dark:bg-zinc-800" role="tablist" aria-label="Audience sections">
          {([['followers', 'Followers'], ['recommendations', 'Recommendations']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={section === key}
              onClick={() => setSection(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                section === key
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {section === 'recommendations' ? (
        <RecommendationsTab />
      ) : (
      <>

      {/* Phones: one compact card, so the list isn't three tall cards away. */}
      {summary && (
        <div className="admin-card p-4 sm:hidden">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {([
              ['Active', summary.active],
              ['Pending', summary.pending],
              ['Unsubscribed', summary.unsubscribed],
            ] as const).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</dt>
                <dd className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {limit && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{summary.active.toLocaleString()} of {limit.toLocaleString()} on your plan</span>
                {usage >= 0.8 && (
                  <Link to={toWorkspace('/settings/billing')} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                    Upgrade
                  </Link>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60">
                <div
                  className={`h-full rounded-full ${usage >= 1 ? 'bg-red-500' : usage >= 0.8 ? 'bg-amber-500' : 'bg-violet-600'}`}
                  style={{ width: `${Math.min(100, usage * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="hidden gap-4 sm:grid sm:grid-cols-3">
          <SummaryCard
            label="Active"
            value={summary.active}
            icon={<UserCheck size={16} />}
            sub={
              limit ? (
                <div>
                  <div className="mb-1.5 flex justify-between">
                    <span>{summary.active.toLocaleString()} of {limit.toLocaleString()} on your plan</span>
                    {usage >= 0.8 && (
                      <Link to={toWorkspace('/settings/billing')} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                        Upgrade
                      </Link>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60">
                    <div
                      className={`h-full rounded-full ${usage >= 1 ? 'bg-red-500' : usage >= 0.8 ? 'bg-amber-500' : 'bg-violet-600'}`}
                      style={{ width: `${Math.min(100, usage * 100)}%` }}
                    />
                  </div>
                </div>
              ) : 'No limit on your plan'
            }
          />
          <SummaryCard label="Pending" value={summary.pending} icon={<Clock size={16} />} sub="Haven't confirmed their email yet" />
          <SummaryCard label="Unsubscribed" value={summary.unsubscribed} icon={<UserMinus size={16} />} sub="Stopped following" />
        </div>
      )}

      {summary && (
        <div className="admin-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Follow form</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {summary.followers_enabled
                ? 'Shown at the end of your posts and on your home page.'
                : 'Hidden. Existing followers stay; nobody new can follow.'}
            </p>
          </div>
          {isOwner ? (
            <label className="inline-flex cursor-pointer items-center gap-3 self-start sm:self-auto">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{summary.followers_enabled ? 'On' : 'Off'}</span>
              <input
                type="checkbox"
                role="switch"
                className="peer sr-only"
                checked={summary.followers_enabled}
                disabled={setEnabled.isPending}
                onChange={(e) => setEnabled.mutate(e.target.checked)}
              />
              <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-violet-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-disabled:opacity-50 dark:bg-zinc-700 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
            </label>
          ) : (
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {summary.followers_enabled ? 'On' : 'Off'} · only the owner can change this
            </span>
          )}
        </div>
      )}

      <div className="admin-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
          {/* Phones: a dropdown, full width like the search box; four tabs don't fit evenly. */}
          <div className="relative sm:hidden">
            <select
              value={tab}
              onChange={(e) => {
                setTab(e.target.value as FollowerStatus | 'all');
                setPage(0);
              }}
              aria-label="Show followers"
              className="w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-3 pr-9 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {TABS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}{summary ? ` · ${countFor(key).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          </div>
          <div className="hidden rounded-xl bg-zinc-100 p-1 sm:flex dark:bg-zinc-800" role="tablist" aria-label="Follower status">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setTab(key);
                  setPage(0);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === key
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email"
              aria-label="Search followers by email"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        {isLoading && <div className="m-4 h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />}

        {list && list.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <Mail size={22} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {query ? 'No followers match that search' : tab === 'active' ? 'No followers yet' : 'Nobody here'}
            </p>
            {!query && tab === 'active' && (
              <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                Readers can follow from the form at the end of your posts.
              </p>
            )}
          </div>
        )}

        {list && list.items.length > 0 && (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {list.items.map((follower) => (
              <li key={follower.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">{follower.email}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[follower.status]}`}>
                      {follower.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    Followed {formatLocalDate(follower.created_at)}
                    {follower.source_post && (
                      <>
                        {' '}from{' '}
                        <Link
                          to={toWorkspace(`/posts/view/${follower.source_post.id}`)}
                          className="font-medium text-zinc-600 hover:text-violet-600 dark:text-zinc-300 dark:hover:text-violet-400"
                        >
                          {follower.source_post.title}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToRemove(follower)}
                  className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-red-50 hover:text-red-600 sm:self-auto dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  aria-label={`Remove ${follower.email}`}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {list && list.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>
              {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + list.items.length} of {list.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
                Previous
              </button>
              <button type="button" disabled={!list.has_more} onClick={() => setPage(page + 1)} className="rounded-lg px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      </>
      )}

      <Modal
        isOpen={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && remove.mutate(toRemove.id)}
        title="Remove this follower?"
        message={`${toRemove?.email ?? ''} will be deleted from your list and won't get any more emails. Use this for fake sign-ups, or when someone asks you to delete their data. They can follow again later if they choose.`}
        confirmText="Remove"
      />
    </div>
  );
};
