import { Users, Heart, Target, Shield } from 'lucide-react';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import { PageHero } from '../shared/components/PageHero';
import { usePageMeta } from '../shared/hooks/usePageMeta';
import { TRIAL_DAYS } from '../shared/plans';

const values = [
  {
    icon: Target,
    title: 'Built for focus',
    description: 'Publishing tools should get out of your way. Inko is designed to let teams focus on writing and growing, not wrestling with software.',
  },
  {
    icon: Shield,
    title: 'Privacy by default',
    description: "Every workspace's content, team and settings are kept separate from every other workspace. Your data is yours. We never sell it.",
  },
  {
    icon: Users,
    title: 'Teams first',
    description: 'Solo creators are welcome, but Inko was built for collaboration. Roles, permissions and shared workspaces are core, not add-ons.',
  },
  {
    icon: Heart,
    title: 'Honest pricing',
    description: 'No bait-and-switch tiers, no surprise overages. What you see on the pricing page is what you pay.',
  },
];

// Only things that have actually shipped, dated from the project's history.
// Add a milestone when it's live, not when it's planned.
const milestones = [
  { date: 'Feb 2026', event: 'Work on Inko begins: a writing studio and API for publishing a blog.' },
  { date: 'May 2026', event: 'Workspaces arrive. Each blog gets its own team, branding and public site.' },
  { date: 'Jul 2026', event: 'Built for teams: owner, editor and author roles, scheduled publishing and guided onboarding.' },
  { date: 'Aug 2026', event: 'In-app notifications and a support desk, so teams stay in the loop and get help fast.' },
  { date: 'Oct 2026', event: 'Free, Pro and Team plans launch, billed in naira through Paystack.' },
];

export const AboutPage = () => {
  usePageMeta(
    'About',
    'Inko is a multi-tenant blog platform built for people who run more than one blog, or more than one writer.'
  );

  return (
    <div className="space-y-0">
      <PageHero
        title="Built for people who"
        highlight="publish together"
        description="Inko started in 2026 with a simple question: why is running more than one blog, or more than one writer, still so painful? This is our answer."
      />

      {/* Mission */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-4xl text-zinc-900 mb-6 leading-tight">
            The problem with managing multiple blogs
          </h2>
          <div className="space-y-4 text-lg text-zinc-600 leading-relaxed">
            <p>
              If you've ever run more than one blog, for clients, products, or brands, you know the pain. Separate logins, inconsistent permissions, and a scramble every time someone joins or leaves the team.
            </p>
            <p>
              Most blogging tools were built for one blog and one team. Agencies and growing companies bolt on workarounds until the whole thing becomes hard to manage.
            </p>
            <p className="font-semibold text-zinc-900">
              Inko puts every blog in its own workspace, with its own team and branding, all managed from one place.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-4">What we believe</h2>
            <p className="text-xl text-zinc-600">The principles that shape every decision we make</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {values.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group bg-white rounded-2xl p-8 border-2 border-zinc-200 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-accent flex items-center justify-center mb-4 transition-colors">
                  <Icon size={22} className="text-zinc-700 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">{title}</h3>
                <p className="text-zinc-600 leading-relaxed text-sm">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-4">How we got here</h2>
            <p className="text-xl text-zinc-600">A brief history of Inko</p>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[5.75rem] top-0 bottom-0 w-px bg-zinc-200" />

            <ol className="space-y-8">
              {milestones.map(({ date, event }, i) => (
                <li key={date} className="flex gap-8 items-start">
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="text-sm font-black text-primary whitespace-nowrap">{date}</span>
                  </div>
                  <div className="relative flex-1 pb-2">
                    {/* Dot */}
                    <div className={`absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-white ring-2 ring-primary ${i === milestones.length - 1 ? 'bg-primary' : 'bg-zinc-300'}`} />
                    <p className="text-zinc-700 leading-relaxed">{event}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <PrimaryCta
        title="Ready to give Inko a try?"
        description={`Start free, or try Pro or Team free for ${TRIAL_DAYS} days.`}
        ctaText="Start free"
        ctaLink="/signup"
        secondaryButtonText="Talk to us"
        secondaryButtonLink="/contact"
        variant="light"
        secondaryText="✓ No card required · ✓ Cancel anytime"
      />
    </div>
  );
};
