// Keep in step with the admin studio's plan catalogue
// (frontend/admin-studio/src/shared/lib/plans.ts), the limits in
// backend/app/core/plans.py, and the plan amounts set in Paystack.

export type Interval = 'monthly' | 'yearly';

export const TRIAL_DAYS = 14;

export const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export const pricingPlans = [
  {
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'For trying Inko out on your own',
    features: [
      { name: 'Just you: 1 member', included: true },
      { name: 'Up to 30 published posts', included: true },
      { name: '7 days of activity history', included: true },
      { name: 'Community support', included: true },
      { name: 'Scheduled publishing', included: false },
      { name: 'Remove Inko branding', included: false },
      { name: 'Custom domain', included: false },
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: { monthly: 5_000, yearly: 50_000 },
    description: 'For serious bloggers and small teams',
    features: [
      { name: 'Up to 3 team members', included: true },
      { name: 'Unlimited published posts', included: true },
      { name: '90 days of activity history', included: true },
      { name: 'Email support', included: true },
      { name: 'Scheduled publishing', included: true },
      { name: 'Remove Inko branding', included: true },
      { name: 'Custom domain', included: true },
    ],
    cta: `Start ${TRIAL_DAYS}-day free trial`,
    highlighted: true,
  },
  {
    name: 'Team',
    price: { monthly: 15_000, yearly: 150_000 },
    description: 'For content teams and agencies',
    features: [
      { name: 'Up to 15 team members', included: true },
      { name: 'Unlimited published posts', included: true },
      { name: '1 year of activity history', included: true },
      { name: 'Priority support', included: true },
      { name: 'Scheduled publishing', included: true },
      { name: 'Remove Inko branding', included: true },
      { name: 'Custom domain', included: true },
    ],
    cta: `Start ${TRIAL_DAYS}-day free trial`,
    highlighted: false,
  },
];

/** Cheapest paid monthly price, for "from ₦X/month" teasers. */
export const lowestPaidMonthly = Math.min(
  ...pricingPlans.map((plan) => plan.price.monthly).filter((price) => price > 0),
);
