import { AlertTriangle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage, toastApiError } from '../../../shared/lib/apiErrors';
import { formatKobo, planName } from '../../../shared/lib/plans';
import { formatLocalDate } from '../../../shared/utils/dates';
import { useBillingActions, useChangePreview, type ChangePreview, type PlanChoice } from '../hooks/useBilling';

interface ChangePlanDialogProps {
  choice: PlanChoice;
  currentPlanName: string;
  onClose: () => void;
  /** Used when the workspace has no saved card the change could go on. */
  onCheckout: (choice: PlanChoice) => void;
}

const errorCode = (error: unknown): string | undefined =>
  (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code;

const Row = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-4 py-2 text-sm">
    <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
    <span className={strong ? 'font-bold text-zinc-900 dark:text-white' : 'font-semibold text-zinc-800 dark:text-zinc-200'}>
      {value}
    </span>
  </div>
);

const summary = (quote: ChangePreview, currentPlanName: string): { intro: string; confirm: string } => {
  const target = `${planName(quote.plan)} (${quote.interval})`;
  if (quote.kind === 'upgrade') {
    return {
      intro: `${target} starts now. You get credit for the unused part of your ${currentPlanName} plan.`,
      confirm: quote.charge_now_kobo > 0 ? `Pay ${formatKobo(quote.charge_now_kobo)} and switch` : 'Switch now',
    };
  }
  if (quote.kind === 'downgrade') {
    return {
      intro: `You keep ${currentPlanName} until ${formatLocalDate(quote.effective_at)}, then ${target} starts. You can undo this before then.`,
      confirm: `Switch on ${formatLocalDate(quote.effective_at)}`,
    };
  }
  if (quote.kind === 'trial') {
    return {
      intro: `Your trial switches to ${target} now. Nothing is charged until your trial ends.`,
      confirm: 'Switch now',
    };
  }
  return {
    intro: `Your ${target} plan will keep renewing. Nothing is charged until the date below.`,
    confirm: `Keep ${planName(quote.plan)}`,
  };
};

export const ChangePlanDialog = ({ choice, currentPlanName, onClose, onCheckout }: ChangePlanDialogProps) => {
  const { data: quote, isLoading, error } = useChangePreview(choice);
  const { changePlan } = useBillingActions();
  const needsCheckout = errorCode(error) === 'PAYMENT_METHOD_REQUIRED';
  const text = quote ? summary(quote, currentPlanName) : null;

  const confirm = () =>
    changePlan.mutate(choice, {
      onSuccess: () => {
        toast.success(
          quote?.kind === 'downgrade'
            ? `${planName(choice.plan)} starts on ${formatLocalDate(quote.effective_at)}.`
            : `You're on the ${planName(choice.plan)} plan.`,
        );
        onClose();
      },
      onError: (e) => toastApiError(e, "Couldn't change your plan. Nothing was charged."),
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-zinc-950/45 backdrop-blur-sm" onClick={changePlan.isPending ? undefined : onClose} />
      <div
        role="dialog"
        aria-label="Change plan"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Switch to {planName(choice.plan)} · {choice.interval === 'yearly' ? 'yearly' : 'monthly'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={changePlan.isPending}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-violet-600" />
            </div>
          ) : needsCheckout ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              We don't have a card saved for this workspace yet, so this goes through Paystack checkout.
            </p>
          ) : error || !quote || !text ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {apiErrorMessage(error) || "We couldn't work out this change. Please try again."}
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{text.intro}</p>
              <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
                {quote.kind === 'upgrade' && (
                  <>
                    <Row label={`${planName(quote.plan)} price`} value={formatKobo(quote.next_charge_kobo)} />
                    <Row label={`Credit for unused ${currentPlanName}`} value={`− ${formatKobo(quote.credit_kobo)}`} />
                  </>
                )}
                <Row label="Due today" value={formatKobo(quote.charge_now_kobo)} strong />
                <Row
                  label={`Then ${formatKobo(quote.next_charge_kobo)} on`}
                  value={formatLocalDate(quote.next_charge_at)}
                />
              </div>
              {quote.kind === 'upgrade' && quote.charge_now_kobo > 0 && (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Charged to the card you pay with now.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/20">
          <button type="button" onClick={onClose} disabled={changePlan.isPending} className="admin-btn admin-btn-secondary px-4 py-2 text-sm">
            Not now
          </button>
          {needsCheckout ? (
            <button
              type="button"
              onClick={() => onCheckout(choice)}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Continue to checkout
            </button>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={!quote || changePlan.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {changePlan.isPending && <Loader2 size={14} className="animate-spin" />}
              {text?.confirm ?? 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
