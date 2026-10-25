import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useBlog } from '../../../app/providers/BlogProvider';
import { usePlanAccess } from '../../billing/hooks/usePlanAccess';
import { getBlogUrl } from '../../../shared/lib/blogUrl';
import { formatLocalDate } from '../../../shared/utils/dates';
import { Modal } from '../../../shared/components/Modal';
import { SponsorForm } from '../components/SponsorForm';
import { AdvertiseSettingsForm } from '../components/AdvertiseSettingsForm';
import { useAdvertiseSettings, useSponsors, type Sponsor, type SponsorState } from '../hooks/useSponsors';

type Tab = 'sponsors' | 'advertise';

const STATE_STYLE: Record<SponsorState, string> = {
  running: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  scheduled: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  ended: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
};

const PLACEMENT_LABEL = { post_end: 'End of posts', home: 'Home page' } as const;

const dates = (s: Sponsor) =>
  s.starts_on || s.ends_on
    ? `${s.starts_on ? formatLocalDate(s.starts_on) : 'Now'} – ${s.ends_on ? formatLocalDate(s.ends_on) : 'no end date'}`
    : 'No end date';

const clickRate = (s: Sponsor) => (s.impressions ? `${((s.clicks / s.impressions) * 100).toFixed(1)}%` : '–');

const SponsorsTab = () => {
  const toWorkspace = useWorkspacePath();
  const { isPaid } = usePlanAccess();
  const { list, save, remove, uploadLogo } = useSponsors();
  const [editing, setEditing] = React.useState<Sponsor | 'new' | null>(null);
  const [toRemove, setToRemove] = React.useState<Sponsor | null>(null);
  const sponsors = list.data ?? [];

  return (
    <div className="space-y-4">
      {!isPaid && (
        <div className="admin-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" />
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Sponsor slots are on Pro and Team</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Run sponsors at the end of your posts or on your home page, and report impressions and clicks back to them.
                {sponsors.length > 0 && ' Your existing sponsors are kept but not shown on Free.'}
              </p>
            </div>
          </div>
          <Link to={toWorkspace('/settings/billing')} className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-violet-700">
            Upgrade
          </Link>
        </div>
      )}

      {editing ? (
        <SponsorForm
          sponsor={editing === 'new' ? null : editing}
          saving={save.isPending}
          uploadLogo={uploadLogo}
          onCancel={() => setEditing(null)}
          onSave={(data) =>
            save.mutate({ id: editing === 'new' ? undefined : editing.id, data }, { onSuccess: () => setEditing(null) })
          }
        />
      ) : (
        isPaid && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 sm:w-auto"
          >
            <Plus size={16} /> Add a sponsor
          </button>
        )
      )}

      {list.isLoading && <div className="h-40 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />}

      {!list.isLoading && sponsors.length === 0 && !editing && (
        <div className="admin-card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <Megaphone size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No sponsors yet</p>
          <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            Turn on your Advertise page so brands can see your audience and get in touch.
          </p>
        </div>
      )}

      {sponsors.length > 0 && (
        <ul className="admin-card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
          {sponsors.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-contain p-1" /> : <Megaphone size={16} className="text-zinc-300" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{s.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATE_STYLE[s.state]}`}>{s.state}</span>
                  </div>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{PLACEMENT_LABEL[s.placement]} · {dates(s)}</p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-center sm:w-64">
                {([['Impressions', s.impressions.toLocaleString()], ['Clicks', s.clicks.toLocaleString()], ['Click rate', clickRate(s)]] as const).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex gap-1 self-end sm:self-auto">
                {isPaid && (
                  <button type="button" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                    <Pencil size={16} />
                  </button>
                )}
                <button type="button" onClick={() => setToRemove(s)} aria-label={`Remove ${s.name}`}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && remove.mutate(toRemove.id)}
        title="Remove this sponsor?"
        message={`${toRemove?.name ?? ''} and its impression and click history will be deleted. To stop showing it but keep the numbers, edit it and pause it instead.`}
        confirmText="Remove"
      />
    </div>
  );
};

const AdvertiseTab = () => {
  const { activeBlog } = useBlog();
  const { settings, save } = useAdvertiseSettings();
  if (!settings.data || !activeBlog) return <div className="h-60 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />;
  return (
    <AdvertiseSettingsForm
      initial={settings.data}
      saving={save.isPending}
      onSave={(data) => save.mutate(data)}
      pageUrl={`${getBlogUrl(activeBlog)}/advertise`}
    />
  );
};

export const SponsorsPage = () => {
  useDocumentTitle('Sponsors');
  const [tab, setTab] = React.useState<Tab>('sponsors');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Sponsors</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Run sponsors on your blog, and invite new ones with your Advertise page.</p>
      </div>

      <div className="grid w-full grid-cols-2 rounded-xl bg-zinc-100 p-1 sm:inline-flex sm:w-auto dark:bg-zinc-800" role="tablist" aria-label="Sponsors sections">
        {([['sponsors', 'Sponsors'], ['advertise', 'Advertise page']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === key
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'sponsors' ? <SponsorsTab /> : <AdvertiseTab />}
    </div>
  );
};
