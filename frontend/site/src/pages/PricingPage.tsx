import { Check, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import { usePageMeta } from '../shared/hooks/usePageMeta';

// Keep in step with the admin studio's plan catalogue
// (frontend/admin-studio/src/shared/lib/plans.ts), the limits in
// backend/app/core/plans.py, and the plan amounts set in Paystack.

type Interval = 'monthly' | 'yearly';

const TRIAL_DAYS = 14;

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const pricingPlans = [
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
    ],
    cta: `Start ${TRIAL_DAYS}-day free trial`,
    highlighted: false,
  },
];

const comparisonRows: { feature: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { feature: 'Team members', values: ['1', '3', '15'] },
  { feature: 'Published posts', values: ['30', 'Unlimited', 'Unlimited'] },
  { feature: 'Drafts', values: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { feature: 'Scheduled publishing', values: [false, true, true] },
  { feature: 'Remove Inko branding', values: [false, true, true] },
  { feature: 'Activity history', values: ['7 days', '90 days', '1 year'] },
  { feature: 'Support', values: ['Community', 'Email', 'Priority'] },
];

const faqs = [
  {
    question: 'Is there a free trial?',
    answer: `Yes. Pro and Team start with a ${TRIAL_DAYS}-day free trial, and no card is needed. When the trial ends you move to the Free plan unless you add a payment. Each workspace gets one trial.`,
  },
  {
    question: 'What happens if I go over a limit or stop paying?',
    answer: "Nothing is deleted. Your posts, drafts and team stay exactly as they are. Free limits only apply to adding something new, like publishing a 31st post or inviting another member.",
  },
  {
    question: 'Can I change plans?',
    answer: "Yes, from Settings → Billing at any time. Upgrades apply straight away and you only pay the difference: unused time on your current plan is credited. Downgrades take effect at the end of the period you've already paid for, and you can undo them before then.",
  },
  {
    question: 'Can I cancel?',
    answer: "Any time, from Settings → Billing. Your plan won't renew, and you keep its features until the end of the period you've paid for.",
  },
  {
    question: 'Is yearly billing cheaper?',
    answer: `Yes. Paying yearly costs 10 months' worth, so you get 2 months free: ${naira.format(50_000)} a year for Pro and ${naira.format(150_000)} a year for Team.`,
  },
  {
    question: 'How do payments work?',
    answer: 'Payments are processed securely by Paystack in Nigerian naira. Your plan renews automatically each month or year until you cancel, and you can update your card from Settings → Billing.',
  },
  {
    question: 'Can I run more than one blog?',
    answer: 'Yes. Each workspace is a separate blog with its own team, branding and content, and each one has its own plan.',
  },
];

const ComparisonCell = ({ value }: { value: string | boolean }) =>
  typeof value === 'boolean' ? (
    value ? <Check size={20} className="mx-auto text-primary" /> : <X size={20} className="mx-auto text-zinc-300" />
  ) : (
    <span className="text-zinc-600">{value}</span>
  );

export const PricingPage = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [interval, setBillingInterval] = useState<Interval>('monthly');

  usePageMeta(
    'Pricing',
    `Simple pricing in naira, from a free plan to teams. Pro and Team come with a ${TRIAL_DAYS}-day free trial, no card required.`
  );

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_right,_rgba(124,58,237,0.18),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_left,_rgba(124,58,237,0.12),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_center,_rgba(139,92,246,0.06),_transparent)]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-black text-zinc-900 mb-6 leading-[1.1]">
            Plans built for{' '}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              every stage
            </span>
          </h1>

          <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto">
            Start free and upgrade when you're ready. Pro and Team come with a {TRIAL_DAYS}-day free trial. No card required.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex justify-center">
            <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-xl bg-zinc-100 p-1">
              {(['monthly', 'yearly'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={interval === value}
                  onClick={() => setBillingInterval(value)}
                  className={`rounded-lg px-5 py-2 text-sm font-bold transition ${
                    interval === value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {value === 'monthly' ? 'Monthly' : 'Yearly'}
                  {value === 'yearly' && <span className="ml-2 text-xs font-bold text-green-600">2 months free</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {pricingPlans.map((plan) => {
              const price = plan.price[interval];
              return (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-8 border-2 transition-all ${
                    plan.highlighted
                      ? 'border-primary bg-white shadow-2xl shadow-zinc-900/5 md:scale-105'
                      : 'border-zinc-200 bg-white hover:shadow-lg hover:border-zinc-300'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="flex items-center gap-2 mb-4 text-primary font-bold text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Most popular
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-zinc-900 mb-2">{plan.name}</h3>
                  <p className="text-zinc-600 text-sm mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <span className="text-5xl font-bold text-zinc-900">{naira.format(price)}</span>
                    {price > 0 && <span className="text-zinc-600">{interval === 'monthly' ? '/month' : '/year'}</span>}
                    <div className="text-sm text-zinc-500 mt-2">
                      {price === 0
                        ? 'Free forever'
                        : interval === 'monthly'
                          ? `or ${naira.format(plan.price.yearly)}/year, 2 months free`
                          : `That's ${naira.format(Math.round(plan.price.yearly / 12))}/month`}
                    </div>
                  </div>

                  <Link
                    to="/signup"
                    className={`block w-full py-3 px-4 rounded-xl font-bold text-center mb-8 transition-all ${
                      plan.highlighted
                        ? 'bg-primary text-white hover:shadow-lg'
                        : 'border-2 border-zinc-200 text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  <div className="space-y-4">
                    {plan.features.map((feature) => (
                      <div key={feature.name} className="flex gap-3 items-start">
                        {feature.included ? (
                          <Check size={20} className="text-zinc-900 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X size={20} className="text-zinc-300 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? 'text-zinc-700 text-sm' : 'text-zinc-400 text-sm'}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-zinc-500">
            Prices in Nigerian naira. Payments are processed securely by Paystack.
          </p>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">Compare plans</h2>
            <p className="text-xl text-zinc-600">Everything that changes from plan to plan</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-zinc-200">
                  <th className="text-left py-4 px-6 font-bold text-zinc-900">Feature</th>
                  {pricingPlans.map((plan) => (
                    <th key={plan.name} className="text-center py-4 px-6 font-bold text-zinc-900">{plan.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-b border-zinc-200 hover:bg-white transition-colors">
                    <td className="py-4 px-6 font-semibold text-zinc-900">{row.feature}</td>
                    {row.values.map((value, i) => (
                      <td key={i} className="text-center py-4 px-6">
                        <ComparisonCell value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">Frequently asked questions</h2>
            <p className="text-xl text-zinc-600">Have questions? We're here to help.</p>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className="border-b border-zinc-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left hover:bg-zinc-50 transition-colors"
                  >
                    <span className="text-lg font-medium text-zinc-900">{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-0">
                      <p className="text-zinc-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <PrimaryCta
        title="Ready to get started?"
        description={`Start free, or try Pro or Team free for ${TRIAL_DAYS} days. No card required.`}
        ctaText="Get started"
        ctaLink="/signup"
      />
    </div>
  );
};
