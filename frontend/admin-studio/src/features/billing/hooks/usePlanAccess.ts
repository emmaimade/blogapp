import { useBlog } from '../../../app/providers/BlogProvider';
import type { PlanKey } from '../../../shared/lib/plans';
import { useBillingOverview } from './useBilling';

/**
 * The plan the active workspace's features follow right now — the same
 * `effective_plan` the backend checks, so an expired trial or lapsed payment
 * counts as Free. Until the billing overview loads, the plan sent with the
 * signed-in user's memberships stands in, so paid features don't flash locked.
 */
export const usePlanAccess = () => {
  const { activeMembership } = useBlog();
  const { data } = useBillingOverview();
  const plan: PlanKey = data?.effective_plan ?? activeMembership?.plan ?? 'free';
  return { plan, isPaid: plan !== 'free' };
};
