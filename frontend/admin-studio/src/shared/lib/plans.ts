// Plan catalogue shown in the admin studio (Billing page, onboarding).
//
// Prices are display-only: Paystack charges whatever the plan in the Paystack
// dashboard says. Keep these in step with those plans, and with the limits in
// backend/app/core/plans.py.

export type PlanKey = 'free' | 'pro' | 'team';
export type BillingInterval = 'monthly' | 'yearly';

export interface PlanInfo {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Naira per month / per year. Free is 0 for both. */
  price: Record<BillingInterval, number>;
  features: string[];
}

export const PLANS: readonly PlanInfo[] = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'For trying Inko out on your own.',
    price: { monthly: 0, yearly: 0 },
    features: [
      'Just you — 1 member',
      'Up to 30 published posts',
      'Inko branding in the footer',
      '7 days of activity history',
      'Community support',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For serious bloggers and small teams.',
    price: { monthly: 5_000, yearly: 50_000 },
    features: [
      'Up to 3 team members',
      'Unlimited published posts',
      'Scheduled publishing',
      'Remove Inko branding',
      '90 days of activity history',
      'Email support',
    ],
  },
  {
    key: 'team',
    name: 'Team',
    tagline: 'For content teams and agencies.',
    price: { monthly: 15_000, yearly: 150_000 },
    features: [
      'Up to 15 team members',
      'Unlimited published posts',
      'Scheduled publishing',
      'Remove Inko branding',
      '1 year of activity history',
      'Priority support',
    ],
  },
];

export const TRIAL_DAYS = 14;

/** Adding a card during a trial: a ₦50 check, refunded straight away. */
export const CARD_CHECK_NAIRA = 50;
export const isCardCheck = (reference: string) => reference.startsWith('inko-card-');

export const planName = (key: string | null | undefined): string =>
  PLANS.find((plan) => plan.key === key)?.name ?? 'Free';

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export const formatNaira = (naira: number): string => nairaFormatter.format(naira);

/** Paystack amounts are in kobo. */
export const formatKobo = (kobo: number): string => formatNaira(kobo / 100);
