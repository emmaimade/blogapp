import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaqList } from '../shared/components/FaqList';
import { PageHero } from '../shared/components/PageHero';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import { usePageMeta } from '../shared/hooks/usePageMeta';
import { TRIAL_DAYS, naira, pricingPlans, type Interval } from '../shared/plans';

const comparisonRows: { feature: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { feature: 'Team members', values: ['1', '3', '15'] },
  { feature: 'Published posts', values: ['30', 'Unlimited', 'Unlimited'] },
  { feature: 'Drafts', values: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { feature: 'Scheduled publishing', values: [false, true, true] },
  { feature: 'Remove Inko branding', values: [false, true, true] },
  { feature: 'Custom domain', values: [false, true, true] },
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
  const [interval, setBillingInterval] = useState<Interval>('monthly');

  usePageMeta(
    'Pricing',
    `Simple pricing in naira, from a free plan to teams. Pro and Team come with a ${TRIAL_DAYS}-day free trial, no card required.`
  );

  return (
    <div className="space-y-0">
      <PageHero
        title="Plans built for"
        highlight="every stage"
        description={`Start free and upgrade when you're ready. Pro and Team come with a ${TRIAL_DAYS}-day free trial. No card required.`}
      />

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
            <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-4">Compare plans</h2>
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
            <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-4">Frequently asked questions</h2>
            <p className="text-xl text-zinc-600">Have questions? We're here to help.</p>
          </div>

          <FaqList faqs={faqs} />
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
