import { ArrowRight, Users, Globe, Heart, Target, Shield, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const milestones = [
  { year: '2022', event: 'INKO founded after frustration managing multiple Ghost instances for agency clients.' },
  { year: '2023', event: 'Launched multi-tenant workspace system. First 50 teams onboarded.' },
  { year: '2024', event: 'Reached 200+ teams. Launched role-based permissions and advanced analytics.' },
  { year: '2025', event: 'REST API and custom domain support shipped. Enterprise tier launched.' },
  { year: '2026', event: 'Serving 500+ teams across 30+ countries. SSO, SAML, and deeper integrations.' },
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
    color: 'bg-violet-600',
  },
  {
    name: 'James Okafor',
    role: 'Head of Product',
    bio: 'Content strategist turned product manager. Obsessed with editorial workflows and publishing UX.',
    initials: 'JO',
    color: 'bg-purple-700',
  },
  {
    name: 'Sofia Lindqvist',
    role: 'Head of Design',
    bio: 'Designed interfaces for B2B SaaS tools for a decade. Believes great design is invisible.',
    initials: 'SL',
    color: 'bg-fuchsia-600',
  },
];

export const AboutPage = () => {
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-accent-border mb-8">
            <span className="text-sm font-semibold text-accent-text">Our story</span>
          </div>

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
            <div className="absolute left-16 top-0 bottom-0 w-px bg-zinc-200" />

            <div className="space-y-8">
              {milestones.map(({ year, event }, i) => (
                <div key={year} className="flex gap-8 items-start">
                  <div className="w-16 flex-shrink-0 text-right">
                    <span className="text-sm font-black text-primary">{year}</span>
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
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_center,_rgba(124,58,237,0.20),_transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to give INKO a try?</h2>
          <p className="text-xl mb-8 text-white/80">Start your 14-day free trial. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/20"
            >
              Start free trial <ArrowRight size={20} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/20 text-white font-bold rounded-xl hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Talk to us
            </Link>
          </div>
          <p className="mt-6 text-white/50 text-sm">✓ No credit card required · ✓ 14-day free trial · ✓ Cancel anytime</p>
        </div>
      </section>

    </div>
  );
};
