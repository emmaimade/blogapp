import { ArrowRight, Check, Layers, PenTool, AppWindow, Megaphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FaqList } from '../shared/components/FaqList';
import { PageHero } from '../shared/components/PageHero';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import {
  BrowserFrame,
  ModerationMock,
  RolesMock,
  ScheduleMock,
  StudioMock,
  WorkspaceSwitcherMock,
} from '../shared/components/mockups';
import { usePageMeta } from '../shared/hooks/usePageMeta';
import { TRIAL_DAYS, lowestPaidMonthly, naira } from '../shared/plans';

// Set to a real studio screenshot in /public (e.g. '/images/hero-studio.webp', 1600×1000)
// to replace the coded dashboard mockup in the hero.
const HERO_SCREENSHOT: string | undefined = undefined;

const trustPoints = ['Free plan, forever', `${TRIAL_DAYS}-day trial of Pro and Team`, 'No card required'];

const steps = [
  {
    title: 'Create a workspace',
    description: 'Give your blog a name, a logo and its own public site. Add more workspaces whenever you need them.',
  },
  {
    title: 'Invite your team',
    description: 'Bring in owners, editors and authors. Everyone gets exactly the access their role needs.',
  },
  {
    title: 'Write, schedule, publish',
    description: 'Draft in the studio, schedule posts for the right moment, and keep the comments healthy.',
  },
];

const highlights: { eyebrow: string; title: string; description: string; points: string[]; visual: ReactNode }[] = [
  {
    eyebrow: 'Roles',
    title: 'The right access for everyone',
    description: 'Owners run the workspace, editors manage content and settings, authors write. No shared passwords, no accidental changes.',
    points: ['Owner, editor and author roles', 'Invite by email or link', 'Access scoped to each workspace'],
    visual: <RolesMock />,
  },
  {
    eyebrow: 'Scheduling',
    title: 'Publish at the right moment',
    description: 'Finish a post today and pick when it goes live. Inko publishes it for you, right on time.',
    points: ['Schedule any post for later', 'See everything queued up', 'Available on Pro and Team'],
    visual: <ScheduleMock />,
  },
  {
    eyebrow: 'Comments',
    title: 'Conversation, with a safety net',
    description: 'Readers can comment on your posts. Anything that looks like spam or abuse can be flagged, and flagged comments are reviewed and removed by moderators.',
    points: ['Comments on every post', 'Flag spam and abuse in one click', 'Flagged comments reviewed by moderators'],
    visual: <ModerationMock />,
  },
];

const audiences = [
  { icon: Layers, title: 'Agencies & studios', description: 'A branded workspace for every client.' },
  { icon: PenTool, title: 'Content teams', description: 'Clear roles from first draft to published.' },
  { icon: AppWindow, title: 'SaaS companies', description: 'Your product blog, on your own domain with Pro.' },
  { icon: Megaphone, title: 'Creators', description: 'Start free, grow into a team.' },
];

const faqs = [
  {
    question: 'Is there really a free plan?',
    answer: 'Yes. The Free plan is free forever for one person and up to 30 published posts. Upgrade only when you need more.',
  },
  {
    question: 'How does the free trial work?',
    answer: `Pro and Team start with a ${TRIAL_DAYS}-day free trial, and no card is needed. When it ends you move to the Free plan unless you add a payment, and nothing is deleted.`,
  },
  {
    question: 'Can I run more than one blog?',
    answer: 'Yes. Each workspace is a separate blog with its own team, branding, content and plan, and you can switch between them from one account.',
  },
  {
    question: 'Can I use my own domain?',
    answer: 'Yes, on the Pro and Team plans. Every workspace gets its own public site, and on a paid plan you can point your own domain at it.',
  },
];

export const HomePage = () => {
  usePageMeta(
    'Multi-tenant blog platform',
    'Launch and manage branded multi-tenant blogs with publishing workflows, workspace roles, and platform-grade administration.',
    { brandFirst: true }
  );

  return (
    <div className="space-y-0">
      {/* 1. Hero */}
      <PageHero
        size="large"
        title="Launch branded blogs"
        highlight="at scale"
        description="Inko is the multi-tenant blog platform for agencies, creators, and SaaS companies. Run every blog from one account, each with its own brand and team."
        media={
          <BrowserFrame>
            {HERO_SCREENSHOT ? (
              <img
                src={HERO_SCREENSHOT}
                alt="The Inko studio dashboard"
                width={1600}
                height={1000}
                className="block w-full h-auto"
              />
            ) : (
              <StudioMock />
            )}
          </BrowserFrame>
        }
      >
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link
            to="/signup"
            className="group flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/10 hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/20 transition-all"
          >
            Start free
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/features"
            className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-zinc-200 bg-white text-zinc-900 font-bold rounded-xl hover:border-zinc-300 hover:bg-zinc-50 transition-all"
          >
            Explore features
          </Link>
        </div>

        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-zinc-600">
          {trustPoints.map((point) => (
            <li key={point} className="flex items-center gap-2">
              <Check size={18} className="text-primary" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </PageHero>

      {/* 2. One account, every blog */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary mb-4">Workspaces</p>
            <h2 className="font-display text-5xl sm:text-6xl text-zinc-900 mb-6 leading-[1.05]">
              One account. <span className="italic text-primary">Every blog.</span>
            </h2>
            <p className="text-lg text-zinc-600 leading-relaxed mb-8">
              Each workspace is its own blog, with its own logo, team, public site and plan. Switch between them in a click, without ever mixing up content or people.
            </p>
            <ul className="space-y-3">
              {['Separate team and content per workspace', 'Your own branding on each, plus a custom domain on Pro and Team', 'A plan per workspace, so you only pay where you need to'].map((point) => (
                <li key={point} className="flex items-start gap-3 text-zinc-700">
                  <Check size={20} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-3xl bg-zinc-50 px-6 py-12 sm:px-12">
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.14),_transparent_60%)]" aria-hidden="true" />
            <div className="relative">
              <WorkspaceSwitcherMock />
            </div>
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_top,_rgba(124,58,237,0.22),_transparent)]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
              Up and running in <span className="italic text-primary-light">minutes</span>
            </h2>
            <p className="text-xl text-zinc-400">Three steps from sign-up to your first published post</p>
          </div>

          <ol className="grid md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-8">
                <span className="font-display text-5xl text-primary-light">{index + 1}</span>
                <h3 className="mt-4 mb-2 text-lg font-bold text-white">{step.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Feature highlights */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto space-y-24">
          {highlights.map((item, index) => (
            <div key={item.title} className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className={index % 2 === 1 ? 'md:order-last' : ''}>
                <p className="text-sm font-bold uppercase tracking-wider text-primary mb-4">{item.eyebrow}</p>
                <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-5 leading-[1.1]">{item.title}</h2>
                <p className="text-lg text-zinc-600 leading-relaxed mb-6">{item.description}</p>
                <ul className="space-y-3">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-zinc-700">
                      <Check size={20} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-accent/70 to-zinc-50 p-6 sm:p-10">{item.visual}</div>
            </div>
          ))}

          <div className="text-center">
            <Link to="/features" className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-hover">
              See every feature <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Built for */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50 border-y border-zinc-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-12 text-center">Built for every kind of publisher</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {audiences.map(({ icon: Icon, title, description }) => (
              <Link
                key={title}
                to="/features"
                className="group rounded-2xl border border-zinc-200 bg-white p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                  <Icon size={22} className="text-primary" aria-hidden="true" />
                </div>
                <h3 className="mb-1 font-bold text-zinc-900">{title}</h3>
                <p className="text-sm text-zinc-600">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Pricing teaser */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border-2 border-zinc-200 p-8">
          <div className="text-center sm:text-left">
            <p className="text-zinc-900 font-bold text-lg">Simple, transparent pricing</p>
            <p className="text-zinc-500 text-sm mt-1">
              Free plan available · Pro from <span className="text-primary font-semibold">{naira.format(lowestPaidMonthly)}/month</span> · {TRIAL_DAYS}-day free trial
            </p>
          </div>
          <Link
            to="/pricing"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-all"
          >
            See all plans <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-12 text-center">Questions, answered</h2>
          <FaqList faqs={faqs} />
          <p className="mt-8 text-center text-zinc-600">
            Something else? <Link to="/contact" className="font-semibold text-primary hover:text-primary-hover">Get in touch</Link>
          </p>
        </div>
      </section>

      {/* 8. Final CTA */}
      <PrimaryCta
        title="Ready to launch your blog?"
        description="Start free and upgrade when you're ready."
        ctaText="Start free"
        ctaLink="/signup"
        className="bg-white"
        secondaryText={`✓ Free plan forever  ✓ ${TRIAL_DAYS}-day trial of Pro and Team  ✓ No card required`}
      />
    </div>
  );
};
