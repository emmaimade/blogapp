import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import type { BillingInterval, PlanKey } from '../../../shared/lib/plans';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';

export interface PaymentTransaction {
  reference: string;
  amount_kobo: number;
  currency: string;
  plan: PlanKey;
  billing_interval: BillingInterval | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface BillingOverview {
  blog_id: number;
  plan: PlanKey;
  /** What features follow right now — Free once a trial or paid period has run out. */
  effective_plan: PlanKey;
  status: SubscriptionStatus;
  billing_interval: BillingInterval | null;
  trial_used: boolean;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  has_paystack_subscription: boolean;
  /** A downgrade waiting for the end of the paid period. */
  pending_plan: PlanKey | null;
  pending_interval: BillingInterval | null;
  pending_change_at: string | null;
  /** Plan changes go through the saved card (prorated) rather than checkout. */
  can_change_plan: boolean;
  /** Card added during a trial that's still running: first payment on trial_ends_at. */
  trial_with_card: boolean;
  transactions: PaymentTransaction[];
}

export interface ChangePreview {
  /** upgrade: now, prorated · downgrade: at period end · resume: renewal restarts · trial: switch before the first charge */
  kind: 'upgrade' | 'downgrade' | 'resume' | 'trial';
  plan: PlanKey;
  interval: BillingInterval;
  charge_now_kobo: number;
  credit_kobo: number;
  effective_at: string;
  next_charge_at: string;
  next_charge_kobo: number;
}

export type PlanChoice = { plan: Exclude<PlanKey, 'free'>; interval: BillingInterval };

export const billingQueryKey = (blogId: number | undefined) => ['billing', blogId] as const;

/** Billing overview for the active workspace. Owner-only on the backend. */
export const useBillingOverview = (enabled = true) => {
  const { activeBlog } = useBlog();
  return useQuery<BillingOverview>({
    queryKey: billingQueryKey(activeBlog?.id),
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/billing`)).data,
    enabled: enabled && !!activeBlog?.id,
  });
};

export const useBillingActions = () => {
  const { activeBlog } = useBlog();
  const queryClient = useQueryClient();
  const blogId = activeBlog?.id;

  const refresh = (data?: BillingOverview) => {
    if (data) queryClient.setQueryData(billingQueryKey(blogId), data);
    else queryClient.invalidateQueries({ queryKey: billingQueryKey(blogId) });
  };

  const checkout = useMutation({
    mutationFn: async (vars: PlanChoice) =>
      (await api.post<{ authorization_url: string; reference: string }>(`/blogs/${blogId}/billing/checkout`, vars)).data,
    // Paystack's hosted checkout; it sends the owner back to the callback page.
    onSuccess: ({ authorization_url }) => window.location.assign(authorization_url),
  });

  const cancel = useMutation({
    mutationFn: async () => (await api.post<BillingOverview>(`/blogs/${blogId}/billing/cancel`)).data,
    onSuccess: refresh,
  });

  const openManageLink = useMutation({
    mutationFn: async () => (await api.get<{ link: string }>(`/blogs/${blogId}/billing/manage-link`)).data,
    // Same tab: the link arrives after an await, so a new-tab open would be
    // caught by popup blockers.
    onSuccess: ({ link }) => window.location.assign(link),
  });

  const changePlan = useMutation({
    mutationFn: async (vars: PlanChoice) =>
      (await api.post<BillingOverview>(`/blogs/${blogId}/billing/change`, vars)).data,
    onSuccess: refresh,
  });

  const undoChange = useMutation({
    mutationFn: async () => (await api.post<BillingOverview>(`/blogs/${blogId}/billing/change/undo`)).data,
    onSuccess: refresh,
  });

  return { checkout, cancel, openManageLink, changePlan, undoChange };
};

/** What a plan change would cost and when it applies. Fetched fresh each time the dialog opens. */
export const useChangePreview = (choice: PlanChoice | null) => {
  const { activeBlog } = useBlog();
  return useQuery<ChangePreview>({
    queryKey: ['billing-change-preview', activeBlog?.id, choice?.plan, choice?.interval],
    queryFn: async () => (await api.post(`/blogs/${activeBlog!.id}/billing/change/preview`, choice)).data,
    enabled: !!choice && !!activeBlog?.id,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
};
