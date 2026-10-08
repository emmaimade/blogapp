import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import api from '../../../shared/api/client';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { billingPath, apiErrorMessage } from '../../../shared/lib/apiErrors';
import { formatLocalDate } from '../../../shared/utils/dates';
import { planName } from '../../../shared/lib/plans';
import { billingQueryKey, type BillingOverview } from '../hooks/useBilling';

/**
 * Paystack sends the owner here after checkout, adding `reference` (and
 * `trxref`) to the callback URL the backend gave it. Verifying here switches
 * the plan on immediately instead of waiting for the webhook.
 */
export const BillingCallbackPage = () => {
  useDocumentTitle('Confirming payment');
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const blogId = Number(params.get('blog'));
  const reference = params.get('reference') || params.get('trxref');

  const { data, isError, error } = useQuery<BillingOverview>({
    queryKey: ['billing-verify', blogId, reference],
    queryFn: async () =>
      (await api.get(`/blogs/${blogId}/billing/verify`, { params: { reference } })).data,
    enabled: !!blogId && !!reference,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) queryClient.setQueryData(billingQueryKey(blogId), data);
  }, [data, blogId, queryClient]);

  const failed = isError || !blogId || !reference;
  // A card added during a trial: nothing charged yet, first payment at trial end.
  const cardedTrial = !!data?.trial_with_card;
  const errorMessage =
    apiErrorMessage(error) ||
    (!reference ? "We couldn't find a payment to confirm." : "We couldn't confirm your payment.");

  return (
    <div className="max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      {failed ? (
        <>
          <XCircle size={40} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Payment not completed</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{errorMessage}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            If you were charged, your plan will update automatically within a few minutes.
          </p>
        </>
      ) : data ? (
        <>
          <CheckCircle2 size={40} className="mx-auto mb-4 text-green-500" />
          {cardedTrial ? (
            <>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Card saved</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Your {planName(data.plan)} trial continues until {formatLocalDate(data.trial_ends_at)}, and your first
                payment is on that day. The small card check has been refunded.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">You're on the {planName(data.plan)} plan</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Thanks for your payment.
                {data.current_period_ends_at && ` Your plan renews on ${formatLocalDate(data.current_period_ends_at)}.`}
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <Loader2 size={40} className="mx-auto mb-4 animate-spin text-violet-600" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Confirming your payment…</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">This only takes a moment.</p>
        </>
      )}

      {(failed || data) && (
        <Link
          to={billingPath()}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Back to billing
        </Link>
      )}
    </div>
  );
};
