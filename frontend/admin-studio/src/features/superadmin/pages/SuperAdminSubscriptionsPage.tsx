import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CreditCard, Loader2, Receipt, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { formatLocalDate } from '../../../shared/utils/dates';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { LoadError } from '../../../shared/ui/LoadError';
import { PlanBadge } from '../../../shared/ui/PlanBadge';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { formatKobo, planName, type PlanKey } from '../../../shared/lib/plans';
import type { PaymentTransaction } from '../../billing/hooks/useBilling';

// Requests go through the shared `api` client: it uses the same-origin /api
// route in production, sends the session cookies, adds the CSRF header to
// writes, and refreshes an expired session.

type Category = 'paying' | 'trialing' | 'past_due' | 'canceled' | 'granted' | 'free';

interface SubscriptionRow {
  blog_id: number;
  blog_name: string;
  owner_email: string | null;
  plan: PlanKey;
  effective_plan: PlanKey;
  status: string;
  billing_interval: 'monthly' | 'yearly' | null;
  trial_used: boolean;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  has_paystack_subscription: boolean;
  monthly_value_kobo: number;
  last_payment_at: string | null;
  category: Category;
}

interface SubscriptionList {
  summary: Record<Category, number> & { mrr_kobo: number };
  subscriptions: SubscriptionRow[];
}

interface SubscriptionDetail extends SubscriptionRow {
  transactions: PaymentTransaction[];
}

const LIST_KEY = ['superadmin-subscriptions'];
const detailKey = (blogId: number) => ['superadmin-subscription', blogId];

const CATEGORY_META: Record<Category, { label: string; className: string }> = {
  paying: { label: 'Paying', className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  trialing: { label: 'Trial', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  past_due: { label: 'Payment failed', className: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
  canceled: { label: 'Cancelled', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' },
  granted: { label: 'Granted', className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  free: { label: 'Free', className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
};

const FILTERS: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'paying', label: 'Paying' },
  { key: 'trialing', label: 'Trial' },
  { key: 'past_due', label: 'Payment failed' },
  { key: 'canceled', label: 'Cancelled' },
  { key: 'granted', label: 'Granted' },
  { key: 'free', label: 'Free' },
];

/** The date that matters for this row, with what it means. */
const keyDate = (row: SubscriptionRow): { label: string; value: string } => {
  switch (row.category) {
    case 'trialing':
      return { label: 'Trial ends', value: formatLocalDate(row.trial_ends_at) };
    case 'paying':
      return { label: 'Renews', value: formatLocalDate(row.current_period_ends_at) };
    case 'past_due':
      return { label: 'Was due', value: formatLocalDate(row.current_period_ends_at) };
    case 'canceled':
      return { label: 'Ends', value: formatLocalDate(row.current_period_ends_at) };
    case 'granted':
      return row.current_period_ends_at
        ? { label: 'Until', value: formatLocalDate(row.current_period_ends_at) }
        : { label: 'Until', value: 'No end date' };
    default:
      return { label: '', value: '—' };
  }
};

/** Paystack keeps charging a renewing subscription, so the manual levers stay off. */
const isRenewingOnPaystack = (row: SubscriptionRow) =>
  row.has_paystack_subscription && (row.status === 'active' || row.status === 'past_due');

const billingLabel = (row: SubscriptionRow) => {
  if (row.monthly_value_kobo > 0) return `${formatKobo(row.monthly_value_kobo)} / mo`;
  if (row.billing_interval) return row.billing_interval === 'yearly' ? 'Yearly' : 'Monthly';
  return '—';
};

const CategoryBadge = ({ category }: { category: Category }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_META[category].className}`}>
    {CATEGORY_META[category].label}
  </span>
);

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

// ── Detail panel ─────────────────────────────────────────────────────────────

const SubscriptionPanel = ({ blogId, onClose }: { blogId: number; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isFetching, refetch } = useQuery<SubscriptionDetail>({
    queryKey: detailKey(blogId),
    queryFn: async () => (await api.get(`/superadmin/subscriptions/${blogId}`)).data,
  });

  const [trialDays, setTrialDays] = useState(7);
  // Until the admin picks one, the trial plan follows the workspace's current paid plan.
  const [pickedTrialPlan, setTrialPlan] = useState<Exclude<PlanKey, 'free'> | null>(null);
  const trialPlan = pickedTrialPlan ?? (data && data.plan !== 'free' ? data.plan : 'pro');
  const [grantPlan, setGrantPlan] = useState<PlanKey>('pro');
  const [grantUntil, setGrantUntil] = useState('');
  const [endReason, setEndReason] = useState('');
  // Earliest end date a grant can have, fixed when the panel opens.
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  const onSaved = (detail: SubscriptionDetail, message: string) => {
    queryClient.setQueryData(detailKey(blogId), detail);
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
    toast.success(message);
  };

  const extendTrial = useMutation({
    mutationFn: async () =>
      (await api.post<SubscriptionDetail>(`/superadmin/subscriptions/${blogId}/extend-trial`, { days: trialDays, plan: trialPlan })).data,
    onSuccess: (detail) => onSaved(detail, `Trial extended to ${formatLocalDate(detail.trial_ends_at)}.`),
    onError: (error) => toastApiError(error, "Couldn't extend the trial."),
  });

  const grant = useMutation({
    mutationFn: async () =>
      (
        await api.post<SubscriptionDetail>(`/superadmin/subscriptions/${blogId}/grant`, {
          plan: grantPlan,
          // End of the chosen day, local time.
          until: grantPlan !== 'free' && grantUntil ? new Date(`${grantUntil}T23:59:59`).toISOString() : null,
        })
      ).data,
    onSuccess: (detail) =>
      onSaved(detail, grantPlan === 'free' ? 'Moved to the Free plan.' : `${planName(grantPlan)} plan granted.`),
    onError: (error) => toastApiError(error, "Couldn't change the plan."),
  });

  const endTrial = useMutation({
    mutationFn: async () =>
      (await api.post<SubscriptionDetail>(`/superadmin/subscriptions/${blogId}/end-trial`, { reason: endReason.trim() })).data,
    onSuccess: (detail) => {
      setEndReason('');
      onSaved(detail, 'Trial ended. The workspace is on Free.');
    },
    onError: (error) => toastApiError(error, "Couldn't end the trial."),
  });

  const locked = data ? isRenewingOnPaystack(data) : true;
  const busy = extendTrial.isPending || grant.isPending || endTrial.isPending;
  const date = data ? keyDate(data) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Subscription details"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Subscription</p>
            <h2 className="mt-1 truncate text-lg font-bold text-zinc-900 dark:text-white">{data?.blog_name ?? '…'}</h2>
            {data?.owner_email && <p className="truncate text-xs text-zinc-500">{data.owner_email}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-10">
            <Loader2 className="animate-spin text-violet-600" />
          </div>
        ) : isError || !data ? (
          <div className="p-5">
            <LoadError title="Couldn't load this subscription" onRetry={() => refetch()} isRetrying={isFetching} />
          </div>
        ) : (
          <div className="space-y-6 p-5">
            {/* Summary */}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Plan in effect</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-1.5">
                  <PlanBadge plan={data.effective_plan} />
                  {data.plan !== data.effective_plan && (
                    <span className="text-xs text-zinc-500">({planName(data.plan)} lapsed)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Status</dt>
                <dd className="mt-1"><CategoryBadge category={data.category} /></dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Billing</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{billingLabel(data)}</dd>
              </div>
              {date?.label && (
                <div>
                  <dt className="text-xs text-zinc-500">{date.label}</dt>
                  <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{date.value}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500">Trial used</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{data.trial_used ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Paystack</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {data.has_paystack_subscription ? 'Subscription linked' : 'Not linked'}
                </dd>
              </div>
            </dl>

            {locked && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                This workspace pays through Paystack. Its owner needs to cancel that subscription before you can change its plan here.
              </div>
            )}

            {/* Extend trial */}
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {data.category === 'trialing' ? 'Extend trial' : 'Start a trial'}
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {data.category === 'trialing'
                  ? 'Adds days to the trial that’s running.'
                  : 'Starts a trial from today, even if the workspace has used one before.'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Days
                  <select value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} disabled={locked} className={`${inputClass} mt-1`}>
                    {[7, 14, 30, 60].map((d) => (
                      <option key={d} value={d}>{d} days</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Plan
                  <select value={trialPlan} onChange={(e) => setTrialPlan(e.target.value as 'pro' | 'team')} disabled={locked} className={`${inputClass} mt-1`}>
                    <option value="pro">Pro</option>
                    <option value="team">Team</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => extendTrial.mutate()}
                disabled={locked || busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {extendTrial.isPending && <Loader2 size={14} className="animate-spin" />}
                {data.category === 'trialing' ? `Add ${trialDays} days` : `Start ${trialDays}-day trial`}
              </button>
            </section>

            {/* End trial */}
            {data.category === 'trialing' && (
              <section className="rounded-xl border border-red-200 p-4 dark:border-red-900/50">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">End trial now</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Moves the workspace to Free straight away. Nothing is deleted, and the owner is told the trial ended.
                </p>
                <label className="mt-3 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Reason (kept in the audit log, not shown to the owner)
                  <input
                    type="text"
                    value={endReason}
                    onChange={(e) => setEndReason(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Duplicate signup"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => endTrial.mutate()}
                  disabled={busy || endReason.trim().length < 3}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {endTrial.isPending && <Loader2 size={14} className="animate-spin" />}
                  End trial
                </button>
              </section>
            )}

            {/* Grant plan */}
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Set plan without payment</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                For partners, refunds or support cases. Choose Free to take a granted plan away.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Plan
                  <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value as PlanKey)} disabled={locked} className={`${inputClass} mt-1`}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="team">Team</option>
                  </select>
                </label>
                {grantPlan !== 'free' && (
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    Until (optional)
                    <input
                      type="date"
                      value={grantUntil}
                      min={tomorrow}
                      onChange={(e) => setGrantUntil(e.target.value)}
                      disabled={locked}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => grant.mutate()}
                disabled={locked || busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {grant.isPending && <Loader2 size={14} className="animate-spin" />}
                {grantPlan === 'free' ? 'Move to Free' : `Grant ${planName(grantPlan)}${grantUntil ? '' : ' with no end date'}`}
              </button>
            </section>

            {/* Payment history */}
            <section>
              <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-white">Payment history</h3>
              {data.transactions.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-6 text-center dark:border-zinc-800">
                  <Receipt size={18} className="mb-1 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-xs text-zinc-500">No payments yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {data.transactions.map((tx) => (
                    <li key={tx.reference} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {planName(tx.plan)}
                          {tx.billing_interval && <span className="font-normal text-zinc-500"> · {tx.billing_interval}</span>}
                        </p>
                        <p className="truncate text-xs text-zinc-500">{formatLocalDate(tx.paid_at ?? tx.created_at)} · {tx.reference}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatKobo(tx.amount_kobo)}</p>
                        <p className={`text-xs ${tx.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                          {tx.status === 'success' ? 'Paid' : tx.status.replace('_', ' ')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const SuperAdminSubscriptionsPage = () => {
  useDocumentTitle('Subscriptions');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [openBlogId, setOpenBlogId] = useState<number | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<SubscriptionList>({
    queryKey: LIST_KEY,
    queryFn: async () => (await api.get('/superadmin/subscriptions')).data,
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.subscriptions ?? []).filter(
      (row) =>
        (filter === 'all' || row.category === filter) &&
        (!term ||
          row.blog_name.toLowerCase().includes(term) ||
          (row.owner_email ?? '').toLowerCase().includes(term) ||
          planName(row.effective_plan).toLowerCase().includes(term)),
    );
  }, [data, search, filter]);

  const summary = data?.summary;
  const cards: { label: string; value: string; hint: string; tone?: string }[] = summary
    ? [
        { label: 'Monthly recurring revenue', value: formatKobo(summary.mrr_kobo), hint: 'Renewing plans, yearly ÷ 12' },
        { label: 'Paying', value: String(summary.paying), hint: 'Renewing through Paystack' },
        { label: 'On trial', value: String(summary.trialing), hint: 'Trial still running' },
        {
          label: 'Payment failed',
          value: String(summary.past_due),
          hint: 'Renewal didn’t go through',
          tone: summary.past_due > 0 ? 'text-red-600 dark:text-red-400' : undefined,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-full space-y-6 p-4 sm:max-w-7xl sm:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Subscriptions</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Plans, revenue and billing status across every workspace.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="h-26 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800" />
            ))
          : cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{card.label}</p>
                <p className={`mt-2 text-2xl font-black text-zinc-900 dark:text-white ${card.tone ?? ''}`}>{card.value}</p>
                <p className="mt-1 text-xs text-zinc-400">{card.hint}</p>
              </div>
            ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Scrolls sideways on small screens; wraps on desktop, where the chips fit. */}
        <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
          {FILTERS.map(({ key, label }) => {
            const count = key === 'all' ? data?.subscriptions.length : summary?.[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  // Violet in both themes: the dark theme forces .text-white to white
                  // (index.css), so a white-on-dark-inverted chip loses its label.
                  filter === key
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {label}
                {count !== undefined && <span className="ml-1.5 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search workspace, owner or plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
      </div>

      {isError ? (
        <LoadError title="Couldn't load subscriptions" onRetry={() => refetch()} isRetrying={isFetching} />
      ) : (
        <>
          {/* Mobile list */}
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
            {isLoading ? (
              <div className="p-6 text-center"><Loader2 className="mx-auto animate-spin text-violet-600" /></div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">{search || filter !== 'all' ? 'No workspaces match.' : 'No workspaces yet.'}</div>
            ) : (
              rows.map((row) => {
                const date = keyDate(row);
                return (
                  <button
                    key={row.blog_id}
                    type="button"
                    onClick={() => setOpenBlogId(row.blog_id)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{row.blog_name}</p>
                      <p className="truncate text-xs text-zinc-500">{row.owner_email ?? `Workspace #${row.blog_id}`}</p>
                      {date.label && <p className="mt-1 text-xs text-zinc-500">{date.label} {date.value}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <PlanBadge plan={row.effective_plan} />
                      <CategoryBadge category={row.category} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                    {['Workspace', 'Plan', 'Status', 'Billing', 'Next date', ''].map((heading) => (
                      <th key={heading} className="px-6 py-4 text-left font-semibold text-zinc-700 dark:text-zinc-300">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((__, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                        {search || filter !== 'all' ? 'No workspaces match.' : 'No workspaces yet.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const date = keyDate(row);
                      return (
                        <tr key={row.blog_id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
                                <CreditCard size={13} className="text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-zinc-900 dark:text-white">{row.blog_name}</p>
                                <p className="truncate text-xs text-zinc-500">{row.owner_email ?? `ID ${row.blog_id}`}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <PlanBadge plan={row.effective_plan} />
                            {row.plan !== row.effective_plan && (
                              <p className="mt-1 text-xs text-zinc-500">{planName(row.plan)} lapsed</p>
                            )}
                          </td>
                          <td className="px-6 py-4"><CategoryBadge category={row.category} /></td>
                          <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">{billingLabel(row)}</td>
                          <td className="px-6 py-4 text-xs text-zinc-500">
                            {date.label ? <><span className="text-zinc-400">{date.label}</span> {date.value}</> : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setOpenBlogId(row.blog_id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
                            >
                              Manage <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {openBlogId !== null && <SubscriptionPanel blogId={openBlogId} onClose={() => setOpenBlogId(null)} />}
    </div>
  );
};
