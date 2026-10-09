import { planName, type PlanKey } from '../lib/plans';

const PLAN_BADGE: Record<PlanKey, string> = {
  free: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  pro: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  team: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

export const PlanBadge = ({ plan }: { plan: PlanKey }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_BADGE[plan] ?? PLAN_BADGE.free}`}>
    {planName(plan)}
  </span>
);
