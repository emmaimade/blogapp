import { ArrowRight, Users, Globe, Heart, Target, Shield, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import { usePageMeta } from '../shared/hooks/usePageMeta';

const values = [
  {
    icon: Target,
    title: 'Built for focus',
    description: 'We believe publishing tools should get out of your way. INKO is designed to let teams focus on writing and growing, not wrestling with software.',
  },
  {
    icon: Shield,
    title: 'Privacy by default',
    description: 'Every workspace is fully isolated at the database level. Your data is yours — we never share it, sell it, or let it cross tenant boundaries.',
  },
  {
    icon: Users,
    title: 'Teams first',
    description: 'Solo creators are welcome, but INKO was built for collaboration. Role-based permissions, editorial workflows, and team analytics are core, not add-ons.',
  },
  {
    icon: Heart,
    title: 'Honest pricing',
    description: 'No bait-and-switch tiers, no surprise overages. What you see on the pricing page is what you pay. We grow when you grow.',
  },
];

// Only things that have actually shipped, dated from the project's history.
// Add a milestone when it's live, not when it's planned.
const milestones = [
  { date: 'Feb 2026', event: 'Work on INKO begins: a writing studio and API for publishing a blog.' },
  { date: 'May 2026', event: 'Workspaces arrive. Each blog gets its own team, branding and public site.' },
  { date: 'Jul 2026', event: 'Built for teams: owner, editor and author roles, scheduled publishing and guided onboarding.' },
  { date: 'Aug 2026', event: 'In-app notifications and a support desk, so teams stay in the loop and get help fast.' },
  { date: 'Oct 2026', event: 'Free, Pro and Team plans launch, billed in naira through Paystack.' },
];

const team = [
  {
    name: 'Alex Mercer',
    role: 'Co-founder & CEO',
    bio: 'Former agency founder who ran 40+ client blogs before building INKO to solve the problem properly.',
    initials: 'AM',
    color: 'bg-primary',
  },
  {
    name: 'Priya Nair',
    role: 'Co-founder & CTO',
    bio: 'Full-stack engineer with a background in multi-tenant SaaS architecture at scale.',
    initials: 'PN',
    color: 'bg-primary',
  },
  {
    name: 'James Okafor',
    role: 'Head of Product',
    bio: 'Content strategist turned product manager. Obsessed with editorial workflows and publishing UX.',
    initials: 'JO',
    color: 'bg-primary',
  },
  {
    name: 'Sofia Lindqvist',
    role: 'Head of Design',
    bio: 'Designed interfaces for B2B SaaS tools for a decade. Believes great design is invisible.',
    initials: 'SL',
    color: 'bg-primary',
  },
];

export const AboutPage = () => {
  usePageMeta(
    'About',
    'Inko started as an internal tool for a digital agency managing dozens of client blogs, built by publishers, for publishers.'
  );

  return (
    <div className="space-y-0">

      {/* Hero */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_right,_rgba(124,58,237,0.18),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_left,_rgba(124,58,237,0.12),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_center,_rgba(139,92,246,0.06),_transparent)]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">

          <h1 className="text-5xl sm:text-6xl font-black text-zinc-900 mb-6 leading-[1.1]">
            Built by publishers,{' '}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              for publishers
            </span>
          </h1>

          <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            INKO started as an internal tool for a digital agency managing dozens of client blogs. We got tired of duct-taping CMS platforms together. So we built what we actually needed.
          </p>

          <div className="flex flex-wrap justify-center gap-8 text-sm text-zinc-600">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <span>500+ teams</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-primary" />
              <span>30+ countries</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <span>Founded 2022</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-black text-zinc-900 mb-6 leading-tight">
                The problem with managing multiple blogs
              </h2>
              <div className="space-y-4 text-zinc-600 leading-relaxed">
                <p>
                  If you've ever run more than one blog — for clients, products, or brands — you know the pain. Separate logins, inconsistent permissions, no shared analytics, and a nightmare when someone leaves the team.
                </p>
                <p>
                  Most CMS platforms were built for one blog, one team. Agencies and SaaS companies bolt on workarounds until the whole thing collapses.
                </p>
                <p className="font-semibold text-zinc-900">
                  INKO was built to solve this once, properly. One platform, isolated workspaces, full control.
                </p>
              </div>
            </div>

            {/* Stats card */}
            <div className="bg-zinc-50 rounded-2xl border-2 border-zinc-200 p-8 space-y-6">
              {[
                { value: '500+', label: 'Active teams', sub: 'agencies, creators & SaaS companies' },
                { value: '10K+', label: 'Posts published', sub: 'across all workspaces monthly' },
                { value: '99.9%', label: 'Uptime SLA', sub: 'on all paid plans' },
                { value: '< 2hrs', label: 'Avg. support response', sub: 'Monday – Friday' },
              ].map(({ value, label, sub }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="text-2xl font-black text-primary w-20 flex-shrink-0">{value}</div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">{label}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">What we believe</h2>
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
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">How we got here</h2>
            <p className="text-xl text-zinc-600">A brief history of INKO</p>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[5.75rem] top-0 bottom-0 w-px bg-zinc-200" />

            <div className="space-y-8">
              {milestones.map(({ date, event }, i) => (
                <div key={date} className="flex gap-8 items-start">
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="text-sm font-black text-primary whitespace-nowrap">{date}</span>
                  </div>
                  <div className="relative flex-1 pb-2">
                    {/* Dot */}
                    <div className={`absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-white ring-2 ring-primary ${i === milestones.length - 1 ? 'bg-primary' : 'bg-zinc-300'}`} />
                    <p className="text-zinc-700 leading-relaxed">{event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">The team</h2>
            <p className="text-xl text-zinc-600">A small team with a clear focus</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map(({ name, role, bio, initials, color }) => (
              <div key={name} className="bg-white rounded-2xl p-6 border-2 border-zinc-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all text-center">
                <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center text-white text-xl font-black mx-auto mb-4 shadow-md`}>
                  {initials}
                </div>
                <h3 className="font-black text-zinc-900 mb-0.5">{name}</h3>
                <p className="text-primary text-xs font-semibold mb-3">{role}</p>
                <p className="text-zinc-500 text-sm leading-relaxed">{bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open roles nudge */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white border-y border-zinc-200">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-zinc-900 font-bold text-lg">We're hiring</p>
            <p className="text-zinc-500 text-sm mt-1">We're a small remote team. If you care about publishing tools, we'd love to hear from you.</p>
          </div>
          <Link
            to="/contact"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-all"
          >
            Get in touch <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* CTA */}
      <PrimaryCta
        title="Ready to give INKO a try?"
        description="Start your 14-day free trial. No credit card required."
        ctaText="Start free trial"
        ctaLink="/signup"
        secondaryButtonText="Talk to us"
        secondaryButtonLink="/contact"
        variant="light"
        secondaryText="✓ No credit card required · ✓ 14-day free trial · ✓ Cancel anytime"
      />

    </div>
  );
};
