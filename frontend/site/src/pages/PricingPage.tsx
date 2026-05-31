import { Check, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const pricingPlans = [
  {
    name: 'Starter',
    price: 29,
    description: 'Perfect for individuals and small blogs',
    features: [
      { name: '1 workspace', included: true },
      { name: 'Up to 3 team members', included: true },
      { name: '500 posts/month storage', included: true },
      { name: 'Basic analytics', included: true },
      { name: 'Community support', included: true },
      { name: 'Standard themes', included: true },
      { name: 'Custom domain', included: false },
      { name: 'API access', included: false },
      { name: 'SSO/SAML', included: false },
      { name: 'Priority support', included: false },
    ],
    cta: 'Get started',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 79,
    description: 'For growing teams and agencies',
    features: [
      { name: 'Unlimited workspaces', included: true },
      { name: 'Up to 20 team members', included: true },
      { name: '5,000 posts/month storage', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Priority email support', included: true },
      { name: 'Custom branding & themes', included: true },
      { name: 'Custom domain', included: true },
      { name: 'API access', included: true },
      { name: 'SSO/SAML', included: true },
      { name: 'Priority support', included: false },
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: null,
    description: 'For large-scale operations',
    features: [
      { name: 'Unlimited workspaces', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'Unlimited storage', included: true },
      { name: 'Advanced analytics & reporting', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'Custom branding & themes', included: true },
      { name: 'Custom domain', included: true },
      { name: 'Full API access', included: true },
      { name: 'Advanced SSO/SAML', included: true },
      { name: '24/7 Phone & Email support', included: true },
    ],
    cta: 'Contact sales',
    highlighted: false,
  },
];

const faqs = [
  {
    question: 'Can I have multiple workspaces?',
    answer: 'Yes! INKO is built for multi-tenant workflows. Starter plans include 1 workspace, while Professional and Enterprise have unlimited workspaces. Each workspace is completely isolated with its own branding, team, and data.',
  },
  {
    question: 'How do you handle data isolation?',
    answer: 'Each workspace is completely isolated at the database level. Team members only see content from their assigned workspace. We use tenant-scoped queries to ensure data privacy and security.',
  },
  {
    question: 'What APIs are available?',
    answer: 'Professional and Enterprise plans include full REST API access. You can programmatically manage posts, comments, users, analytics, and more. Full API documentation is available in our docs.',
  },
  {
    question: 'Do you offer data export?',
    answer: 'Absolutely. Export your blog content anytime in standard formats (JSON, CSV). No vendor lock-in. You own your data and can move it whenever you need.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! All plans come with a 14-day free trial. No credit card required to get started. Upgrade or cancel anytime.',
  },
  {
    question: 'What support is included?',
    answer: 'Starter includes community support. Professional gets priority email support. Enterprise customers get dedicated account managers and 24/7 phone support.',
  },
  {
    question: 'Can I change plans?',
    answer: "Yes, you can upgrade or downgrade your plan anytime. We'll prorate charges based on your usage cycle.",
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer: "Yes! Annual plans include 20% discount. That's $232/year for Starter (instead of $290) and $632/year for Professional (instead of $790).",
  },
];

export const PricingPage = () => {
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-accent-border mb-8">
            <span className="text-sm font-semibold text-accent-text">
              Transparent pricing
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-black text-zinc-900 mb-6 leading-[1.1]">
            Plans built for{' '}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              every stage
            </span>
          </h1>
          
          <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto">
            Start free, grow with us. All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border-2 transition-all ${
 plan.highlighted
 ? 'border-primary bg-white shadow-2xl shadow-zinc-900/5 scale-105'
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
                  {plan.price ? (
                    <div>
                      <span className="text-5xl font-bold text-zinc-900">${plan.price}</span>
                      <span className="text-zinc-600">/month</span>
                      <div className="text-sm text-zinc-500 mt-2">or ${Math.round(plan.price * 12 * 0.8)}/year (save 20%)</div>
                    </div>
                  ) : (
                    <div className="text-3xl font-bold text-zinc-900">Custom pricing</div>
                  )}
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
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">Detailed comparison</h2>
            <p className="text-xl text-zinc-600">Choose the perfect plan for your needs</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-zinc-200">
                  <th className="text-left py-4 px-6 font-bold text-zinc-900">Feature</th>
                  <th className="text-center py-4 px-6 font-bold text-zinc-900">Starter</th>
                  <th className="text-center py-4 px-6 font-bold text-zinc-900">Professional</th>
                  <th className="text-center py-4 px-6 font-bold text-zinc-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">Workspaces</td>
                  <td className="text-center py-4 px-6 text-zinc-600">1</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Unlimited</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Unlimited</td>
                </tr>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">Team Members</td>
                  <td className="text-center py-4 px-6 text-zinc-600">3</td>
                  <td className="text-center py-4 px-6 text-zinc-600">20</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Unlimited</td>
                </tr>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">Monthly Storage</td>
                  <td className="text-center py-4 px-6 text-zinc-600">500 posts</td>
                  <td className="text-center py-4 px-6 text-zinc-600">5,000 posts</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Unlimited</td>
                </tr>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">Analytics</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Basic</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Advanced</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Advanced +</td>
                </tr>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">Custom Domain</td>
                  <td className="text-center py-4 px-6"><X size={20} className="mx-auto text-zinc-300" /></td>
                  <td className="text-center py-4 px-6"><Check size={20} className="mx-auto text-primary" /></td>
                  <td className="text-center py-4 px-6"><Check size={20} className="mx-auto text-primary" /></td>
                </tr>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">API Access</td>
                  <td className="text-center py-4 px-6"><X size={20} className="mx-auto text-zinc-300" /></td>
                  <td className="text-center py-4 px-6"><Check size={20} className="mx-auto text-primary" /></td>
                  <td className="text-center py-4 px-6"><Check size={20} className="mx-auto text-primary" /></td>
                </tr>
                <tr className="border-b border-zinc-200 hover:bg-white transition-colors">
                  <td className="py-4 px-6 font-semibold text-zinc-900">Support</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Community</td>
                  <td className="text-center py-4 px-6 text-zinc-600">Email</td>
                  <td className="text-center py-4 px-6 text-zinc-600">24/7 Phone</td>
                </tr>
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

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group border-2 border-zinc-200 rounded-xl p-6 hover:border-zinc-300 transition-all cursor-pointer"
              >
                <summary className="flex items-center justify-between font-bold text-zinc-900">
                  <span>{faq.question}</span>
                  <span className="text-zinc-900 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-zinc-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-zinc-900 mb-6">Ready to get started?</h2>
          <p className="text-xl text-zinc-600 mb-8">
            Join hundreds of teams using INKO. 14-day free trial, no credit card required.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-zinc-900/10 hover:shadow-xl hover:shadow-zinc-900/20 transition-all"
          >
            Start free trial
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
};
