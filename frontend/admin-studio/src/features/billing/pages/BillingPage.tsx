import { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, CreditCard, Loader2, Receipt, Building2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { formatLocalDate } from '../../../shared/utils/dates';
import { SettingsSkeleton } from '../../../shared/ui/SettingsSkeleton';
import { LoadError } from '../../../shared/ui/LoadError';
import { Modal } from '../../../shared/components/Modal';
import { toastApiError } from '../../../shared/lib/apiErrors';
import {
  CARD_CHECK_NAIRA,
  PLANS,
  formatKobo,
  isCardCheck,
  formatNaira,
  planName,
  type BillingInterval,
  type PlanInfo,
} from '../../../shared/lib/plans';
import { useBillingActions, useBillingOverview, type BillingOverview, type PlanChoice } from '../hooks/useBilling';
import { ChangePlanDialog } from '../components/ChangePlanDialog';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useAuth } from '../../auth/context/AuthContext';
import { isSuperAdmin } from '../../auth/lib/accessControl';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A card is on file but the trial hasn't ended, so nothing has been charged yet. */
const isCardedTrial = (billing: BillingOverview): boolean => billing.trial_with_card;

const priceOf = (plan: string, interval: BillingInterval | null) =>
  PLANS.find((p) => p.key === plan)?.price[interval ?? 'monthly'] ?? 0;

/** A paid plan given by a superadmin rather than paid for through Paystack. */
const isGranted = (billing: BillingOverview): boolean =>
  billing.status === 'active' && !billing.has_paystack_subscription && billing.effective_plan !== 'free';

const daysUntil = (iso: string | null): number =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS)) : 0;

const isFuture = (iso: string | null): boolean => !!iso && new Date(iso).getTime() > Date.now();

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  trialing: { label: 'Trial', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  past_due: { label: 'Payment failed', className: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
  canceled: { label: 'Cancelled', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  expired: { label: 'Expired', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

/** One sentence on where the workspace stands right now. */
const describeStatus = (billing: BillingOverview): string => {
  const paidPlan = planName(billing.plan);

  if (billing.status === 'trialing') {
    if (billing.effective_plan === billing.plan) {
      const days = daysUntil(billing.trial_ends_at);
      return `Your ${paidPlan} trial has ${days} ${days === 1 ? 'day' : 'days'} left (ends ${formatLocalDate(billing.trial_ends_at)}). Add a card to keep ${paidPlan} after that — you won't be charged until the trial ends.`;
    }
    return `Your ${paidPlan} trial ended on ${formatLocalDate(billing.trial_ends_at)}. You're on the Free plan now — your posts and team are untouched.`;
  }
  if (billing.status === 'past_due') {
    return billing.effective_plan === billing.plan
      ? `We couldn't renew your ${paidPlan} plan. Update your card soon to keep its features.`
      : `We couldn't renew your ${paidPlan} plan, so you're on Free features for now. Update your card to restore ${paidPlan}.`;
  }
  if (billing.status === 'canceled') {
    return isFuture(billing.current_period_ends_at)
      ? `Your ${paidPlan} plan won't renew. You keep its features until ${formatLocalDate(billing.current_period_ends_at)}.`
      : `Your ${paidPlan} plan has ended. You're on the Free plan now.`;
  }
  if (isCardedTrial(billing) && !billing.pending_plan) {
    const price = formatNaira(priceOf(billing.plan, billing.billing_interval));
    return `Your trial runs until ${formatLocalDate(billing.trial_ends_at)}. Your card is saved, and your first payment of ${price} (${billing.billing_interval}) is on that day.`;
  }
  if (isGranted(billing)) {
    return billing.current_period_ends_at
      ? `Inko gave this workspace the ${paidPlan} plan until ${formatLocalDate(billing.current_period_ends_at)}. Add a payment before then to keep it.`
      : `Inko gave this workspace the ${paidPlan} plan.`;
  }
  if (billing.effective_plan !== 'free' && billing.current_period_ends_at) {
    const interval = billing.billing_interval === 'yearly' ? 'yearly' : 'monthly';
    if (billing.pending_plan) {
      return `Billed ${interval} until ${formatLocalDate(billing.pending_change_at)}, when you move to ${planName(billing.pending_plan)}.`;
    }
    return `Billed ${interval}. Renews on ${formatLocalDate(billing.current_period_ends_at)}.`;
  }
  if (billing.effective_plan !== 'free') {
    return `You're on the ${planName(billing.effective_plan)} plan.`;
  }
  return billing.trial_used
    ? "You're on the Free plan. Upgrade any time to unlock more."
    : `You're on the Free plan. Choose Pro or Team below to upgrade.`;
};

const canCancel = (billing: BillingOverview): boolean =>
  (billing.status === 'trialing' && billing.effective_plan !== 'free' && !billing.has_paystack_subscription) ||
  (billing.has_paystack_subscription && (billing.status === 'active' || billing.status === 'past_due'));

const TIER = { free: 0, pro: 1, team: 2 } as const;

/** Higher tier, or same tier going monthly → yearly. Mirrors the backend's rule. */
const isUpgrade = (billing: BillingOverview, plan: PlanInfo, interval: BillingInterval) =>
  TIER[plan.key] !== TIER[billing.plan]
    ? TIER[plan.key] > TIER[billing.plan]
    : interval === 'yearly' && billing.billing_interval === 'monthly';

type CardAction = { label: string; enabled: boolean; mode: 'checkout' | 'change' };

/** The action a plan card offers, given where the workspace is now. */
const planAction = (
  plan: PlanInfo,
  interval: BillingInterval,
  billing: BillingOverview,
): CardAction => {
  const action = planActionLabel(plan, interval, billing);
  return { ...action, mode: billing.can_change_plan && plan.key !== 'free' ? 'change' : 'checkout' };
};

const planActionLabel = (
  plan: PlanInfo,
  interval: BillingInterval,
  billing: BillingOverview,
): { label: string; enabled: boolean } => {
  const current = billing.effective_plan;

  // Paying through Paystack: switches are prorated or scheduled on the saved card.
  if (billing.can_change_plan && plan.key !== 'free') {
    const isCurrent = plan.key === billing.plan && interval === billing.billing_interval;
    if (plan.key === billing.pending_plan && interval === billing.pending_interval) {
      return { label: `Starts ${formatLocalDate(billing.pending_change_at)}`, enabled: false };
    }
    if (isCurrent) {
      if (billing.pending_plan) return { label: `Keep ${plan.name}`, enabled: true };
      if (billing.status === 'canceled') return { label: `Resume ${plan.name}`, enabled: true };
      return { label: 'Current plan', enabled: false };
    }
    if (plan.key === billing.plan) return { label: `Switch to ${interval}`, enabled: true };
    return { label: isUpgrade(billing, plan, interval) ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`, enabled: true };
  }

  if (plan.key === 'free') {
    if (current === 'free') return { label: 'Current plan', enabled: false };
    if (billing.status === 'trialing') return { label: 'End trial to switch', enabled: false };
    // Already cancelled: Free takes over by itself when the paid period ends.
    if (billing.status === 'canceled' && billing.current_period_ends_at) {
      return { label: `Starts ${formatLocalDate(billing.current_period_ends_at)}`, enabled: false };
    }
    return { label: 'Cancel your plan to switch', enabled: false };
  }

  const payingForThis =
    billing.has_paystack_subscription &&
    billing.status === 'active' &&
    billing.plan === plan.key &&
    billing.billing_interval === interval;
  if (payingForThis) return { label: 'Current plan', enabled: false };

  if (billing.status === 'trialing' && current === plan.key) {
    return { label: `Add card — keep ${plan.name}`, enabled: true };
  }
  // Cancelled but still inside the paid period: they have this plan, it just won't renew.
  if (isGranted(billing) && current === plan.key) {
    // A granted plan with an end date can be paid for to keep it going.
    return billing.current_period_ends_at
      ? { label: `Pay to keep ${plan.name}`, enabled: true }
      : { label: 'Current plan', enabled: false };
  }
  if (billing.status === 'canceled' && current === plan.key) {
    return { label: `Resubscribe to ${plan.name}`, enabled: true };
  }
  if (current !== 'free') {
    return { label: billing.plan === plan.key ? `Switch to ${interval}` : `Switch to ${plan.name}`, enabled: true };
  }
  return { label: `Upgrade to ${plan.name}`, enabled: true };
};

/** Billing belongs to a workspace, so there's nothing to show without one selected. */
const NoWorkspaceNotice = () => (
  <div className="max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      <Building2 size={18} />
    </div>
    <h2 className="text-base font-bold text-zinc-900 dark:text-white">No workspace selected</h2>
    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
      Billing is managed per workspace. Select a workspace you own to see its plan.
    </p>
  </div>
);

export const BillingPage = () => {
  useDocumentTitle('Billing');
  const { user } = useAuth();
  const { activeBlog, activeRole, isLoading: isBlogLoading } = useBlog();
  // Billing is the workspace owner's page. A superadmin manages plans from
  // Subscriptions instead — unless they own the active workspace themselves.
  const superAdminElsewhere = isSuperAdmin(user) && activeRole !== 'owner';
  const { data: billing, isLoading, isError, isFetching, refetch } = useBillingOverview(!superAdminElsewhere);
  const { checkout, cancel, openManageLink, undoChange } = useBillingActions();
  const [changeTarget, setChangeTarget] = useState<PlanChoice | null>(null);
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isBlogLoading) return <SettingsSkeleton cardsCount={3} fieldsPerCard={2} />;
  if (superAdminElsewhere) return <Navigate to="/admin/subscriptions" replace />;
  if (isLoading) return <SettingsSkeleton cardsCount={3} fieldsPerCard={2} />;
  if (!activeBlog) return <NoWorkspaceNotice />;
  if (isError || !billing) {
    return <LoadError title="Couldn't load billing" onRetry={() => refetch()} isRetrying={isFetching} />;
  }

  const badge = STATUS_BADGES[billing.status] ?? STATUS_BADGES.active;
  const isTrialCancel = billing.status === 'trialing' && !billing.has_paystack_subscription;

  const startCheckout = (plan: PlanInfo | PlanChoice['plan'], chosenInterval: BillingInterval = interval) => {
    const key = typeof plan === 'string' ? plan : plan.key;
    if (key === 'free') return;
    setPendingPlan(key);
    checkout.mutate(
      { plan: key, interval: chosenInterval },
      {
        onError: (error) => {
          setPendingPlan(null);
          toastApiError(error, "Couldn't start checkout. Please try again.");
        },
      },
    );
  };

  const keepCurrentPlan = () =>
    undoChange.mutate(undefined, {
      onSuccess: () => toast.success(`You'll stay on ${planName(billing.plan)}.`),
      onError: (error) => toastApiError(error, "Couldn't undo the change. Please try again."),
    });

  const handleCancel = () => {
    cancel.mutate(undefined, {
      onSuccess: () => toast.success(isTrialCancel ? 'Trial ended. You’re on the Free plan.' : 'Your plan won’t renew.'),
      onError: (error) => toastApiError(error, "Couldn't cancel. Please try again."),
    });
  };

  return (
    <div className="max-w-4xl space-y-6 pb-24 lg:pb-12">
      {/* ─── Current plan ─── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{planName(billing.effective_plan)}</h2>
              {billing.effective_plan !== 'free' || billing.status !== 'active' ? (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
              ) : null}
            </div>
            <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">{describeStatus(billing)}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {billing.has_paystack_subscription && billing.status !== 'canceled' && (
              <button
                type="button"
                onClick={() => openManageLink.mutate(undefined, { onError: (e) => toastApiError(e, "Couldn't open card settings.") })}
                disabled={openManageLink.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {openManageLink.isPending ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                Update card
              </button>
            )}
            {canCancel(billing) && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                disabled={cancel.isPending}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {cancel.isPending && <Loader2 size={14} className="animate-spin" />}
                {isTrialCancel ? 'End trial' : 'Cancel plan'}
              </button>
            )}
          </div>
        </div>

        {billing.pending_plan && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <ArrowRight size={16} className="shrink-0" />
              Switching to {planName(billing.pending_plan)} ({billing.pending_interval}) on {formatLocalDate(billing.pending_change_at)}.
            </span>
            <button
              type="button"
              onClick={keepCurrentPlan}
              disabled={undoChange.isPending}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-transparent dark:text-violet-200 sm:self-auto"
            >
              {undoChange.isPending && <Loader2 size={12} className="animate-spin" />}
              Keep {planName(billing.plan)}
            </button>
          </div>
        )}

        {billing.status === 'past_due' && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Your last renewal didn't go through. Use “Update card” to add a working card — Paystack will retry the charge.
          </div>
        )}
      </div>

      {/* ─── Plans ─── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Plans</h2>
          <div role="radiogroup" aria-label="Billing interval" className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            {(['monthly', 'yearly'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                onClick={() => setBillingInterval(value)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  interval === value
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {value === 'monthly' ? 'Monthly' : 'Yearly'}
                {value === 'yearly' && <span className="ml-1.5 text-xs font-bold text-green-600 dark:text-green-400">2 months free</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const action = planAction(plan, interval, billing);
            const isCurrent = billing.effective_plan === plan.key;
            const isLoadingThis = checkout.isPending && pendingPlan === plan.key;
            return (
              <div
                key={plan.key}
                className={`flex flex-col rounded-xl border p-5 ${
                  isCurrent
                    ? 'border-violet-500 ring-2 ring-violet-500/15 dark:border-violet-500'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{plan.tagline}</p>
                <p className="mt-4 text-2xl font-black text-zinc-900 dark:text-white">
                  {plan.price[interval] === 0 ? '₦0' : formatNaira(plan.price[interval])}
                  {plan.price[interval] > 0 && (
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {interval === 'monthly' ? ' / month' : ' / year'}
                    </span>
                  )}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <Check size={14} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!action.enabled || checkout.isPending}
                  onClick={() =>
                    plan.key === 'free'
                      ? undefined
                      : action.mode === 'change'
                        ? setChangeTarget({ plan: plan.key, interval })
                        : startCheckout(plan)
                  }
                  className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    action.enabled
                      ? 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60'
                      : 'cursor-default bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {isLoadingThis && <Loader2 size={14} className="animate-spin" />}
                  {isLoadingThis ? 'Opening Paystack…' : action.label}
                </button>
              </div>
            );
          })}
        </div>
        {billing.status === 'trialing' && billing.effective_plan !== 'free' && (
          <p className="mt-4 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-950/20 dark:text-violet-200">
            Adding a card makes a {formatNaira(CARD_CHECK_NAIRA)} check that's refunded straight away. You're not charged
            for your plan until your trial ends on {formatLocalDate(billing.trial_ends_at)}.
          </p>
        )}
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Payments are processed securely by Paystack. Prices are in Nigerian naira.
        </p>
      </div>

      {/* ─── Payment history ─── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">Payment history</h2>
        {billing.transactions.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Receipt size={22} className="mb-2 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No payments yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {billing.transactions.map((tx) => (
              <li key={tx.reference} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {isCardCheck(tx.reference) ? 'Card check' : planName(tx.plan)}
                    {tx.billing_interval && !isCardCheck(tx.reference) && (
                      <span className="font-normal text-zinc-500"> · {tx.billing_interval}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {formatLocalDate(tx.paid_at ?? tx.created_at)} · {tx.reference}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">{formatKobo(tx.amount_kobo)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      tx.status === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {tx.status === 'success' ? 'Paid' : tx.status === 'refunded' ? 'Refunded' : tx.status.replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {changeTarget && (
        <ChangePlanDialog
          choice={changeTarget}
          currentPlanName={planName(billing.plan)}
          onClose={() => setChangeTarget(null)}
          onCheckout={(choice) => {
            setChangeTarget(null);
            startCheckout(choice.plan, choice.interval);
          }}
        />
      )}

      <Modal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        title={isTrialCancel ? 'End your trial?' : 'Cancel your plan?'}
        message={
          isTrialCancel
            ? "You'll move to the Free plan straight away. Your posts and team stay, but Free limits apply to anything new. A workspace only gets one trial."
            : `Your ${planName(billing.plan)} plan won't renew. You keep its features until ${formatLocalDate(billing.current_period_ends_at)}, then move to Free. Nothing is deleted.`
        }
        confirmText={isTrialCancel ? 'End trial' : 'Cancel plan'}
        cancelText={isTrialCancel ? 'Keep trial' : 'Keep plan'}
      />
    </div>
  );
};
