import {
  Building2,
  Users,
  FileText,
  ShieldCheck,
  Globe,
  CalendarClock,
  MessageSquare,
  Bell,
  LifeBuoy,
  Palette,
  ArrowRight,
  Layers,
  PenTool,
  AppWindow,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import { PageHero } from '../shared/components/PageHero';
import { usePageMeta } from '../shared/hooks/usePageMeta';

interface MainFeature {
  icon: LucideIcon;
  title: string;
  description: string;
  details: string[];
  /** 3:2 illustration or screenshot in /public; rows without one show an icon panel. */
  image?: string;
  use_case: string;
}

const mainFeatures: MainFeature[] = [
  {
    icon: Building2,
    title: 'Multi-tenant Workspaces',
    description: 'Run separate blogs, each with its own team, branding, and public site, from one account.',
    details: [
      'Data kept separate between workspaces',
      'Your own logo and branding on each blog',
      'A public site for every workspace, with custom domains on Pro and Team',
      'Separate team and plan per workspace',
    ],
    image: '/images/multi-tenant-workspaces.webp',
    use_case: 'Agencies managing multiple client blogs',
  },
  {
    icon: Users,
    title: 'Role-based Collaboration',
    description: 'Owners, editors, and authors work with clear permissions scoped to their own workspace.',
    details: [
      'Owner: Full workspace control',
      'Editor: Content & settings management',
      'Author: Create & edit posts',
    ],
    image: '/images/role-based-collaboration.webp',
    use_case: 'Grow your team without giving everyone the keys',
  },
  {
    icon: FileText,
    title: 'Publishing Control',
    description: 'Write, schedule, and publish posts, and give readers a place to respond.',
    details: [
      'Drafts, published and scheduled posts',
      'Scheduled publishing on Pro and Team',
      'Tags to organise your content',
      'Comments, with flagging for spam and abuse',
    ],
    image: '/images/publishing-control.webp',
    use_case: 'Control over your whole publishing workflow',
  },
  {
    icon: ShieldCheck,
    title: 'Platform-grade Admin',
    description: 'Give super admins platform visibility while keeping everyday users focused on their own workspace.',
    details: [
      'Platform-wide analytics dashboard',
      'User and workspace management',
      'Billing and subscription oversight',
      'Audit log for investigations',
    ],
    image: '/images/platform-admin.webp',
    use_case: 'Oversight for whoever runs the platform',
  },
];

const moreFeatures = [
  {
    icon: Globe,
    title: 'Custom Domains',
    description: 'Point your own domain at a workspace for a fully branded reading experience. Available on Pro and Team.',
  },
  {
    icon: CalendarClock,
    title: 'Scheduled Publishing',
    description: 'Write ahead and pick the moment a post goes live. Available on Pro and Team.',
  },
  {
    icon: MessageSquare,
    title: 'Comments & Flagging',
    description: 'Readers can join the conversation. Spam and abuse can be flagged for moderators to review and remove.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'In-app alerts for comments, invitations, and important workspace events.',
  },
  {
    icon: LifeBuoy,
    title: 'Built-in Support',
    description: 'Raise a support request from inside the studio and track it until it is resolved.',
  },
  {
    icon: Palette,
    title: 'Workspace Branding',
    description: 'Add your logo, and remove Inko branding from your public site on paid plans.',
  },
];

const useCases = [
  {
    title: 'Agencies & Studios',
    description: 'Run every client blog from one account, each in its own branded workspace.',
    icon: Layers,
    features: ['A workspace per client', 'Client branding', 'Custom domains on paid plans', 'Team roles'],
  },
  {
    title: 'Content Teams',
    description: 'Give writers and editors the access they need, and nothing more.',
    icon: PenTool,
    features: ['Owner, editor and author roles', 'Scheduled publishing', 'Tags', 'Reader comments'],
  },
  {
    title: 'SaaS Companies',
    description: 'Run your product blog with your own branding on your own domain.',
    icon: AppWindow,
    features: ['Custom domain on paid plans', 'Your logo', 'No Inko branding on paid plans', 'Team collaboration'],
  },
  {
    title: 'Creators & Publishers',
    description: 'Start a blog for free and grow into a team when you are ready.',
    icon: Megaphone,
    features: ['Free plan', 'Quick setup', 'Scheduled publishing', 'Room to add a team'],
  },
];

export const FeaturesPage = () => {
  usePageMeta(
    'Features',
    "Explore Inko's multi-tenant workspaces, team roles, scheduled publishing, custom domains, and reader comments."
  );

  return (
    <div className="space-y-0">
      <PageHero
        title="Everything you need to"
        highlight="publish at scale"
        description="Built-in features designed for teams, from solo creators to agencies running dozens of blogs."
      />

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-16">
            {mainFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              const imageFirst = index % 2 === 1;

              return (
                <div key={feature.title} className="grid md:grid-cols-2 gap-12 items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
                        <IconComponent className="text-primary" size={32} />
                      </div>
                      <h2 className="text-2xl font-bold text-zinc-900">{feature.title}</h2>
                    </div>

                    <p className="text-lg text-zinc-600 mb-6 leading-relaxed">{feature.description}</p>

                    <ul className="space-y-3 mb-8">
                      {feature.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                          <span className="text-zinc-700">{detail}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="inline-flex flex-wrap items-center gap-2 px-4 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
                      <span className="text-xs font-semibold text-zinc-950 uppercase tracking-wider">Use case</span>
                      <span className="text-sm text-zinc-900">{feature.use_case}</span>
                    </div>
                  </div>

                  <div className={`rounded-2xl bg-accent/40 overflow-hidden aspect-[3/2] ${imageFirst ? 'md:order-first' : ''}`}>
                    {feature.image ? (
                      <img
                        src={feature.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={1200}
                        height={800}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.16),_transparent_70%)]">
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-xl shadow-primary/10">
                          <IconComponent className="text-primary" size={44} aria-hidden="true" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-4">And there's more</h2>
            <p className="text-xl text-zinc-600">The details that make day-to-day publishing easier</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {moreFeatures.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group bg-white rounded-2xl p-8 border-2 border-zinc-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-accent flex items-center justify-center mb-4 transition-colors">
                    <IconComponent className="text-zinc-700 group-hover:text-primary transition-colors" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">{feature.title}</h3>
                  <p className="text-zinc-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl text-zinc-900 mb-4">Built for every team</h2>
            <p className="text-xl text-zinc-600">How Inko fits the way you publish</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {useCases.map((useCase) => {
              const IconComponent = useCase.icon;
              return (
                <div
                  key={useCase.title}
                  className="rounded-2xl p-8 bg-zinc-50 border-2 border-zinc-200 hover:border-zinc-300 hover:shadow-lg transition-all"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent mb-4">
                    <IconComponent className="text-primary" size={28} aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900 mb-2">{useCase.title}</h3>
                  <p className="text-zinc-600 text-lg mb-6">{useCase.description}</p>

                  <ul className="space-y-2 mb-6 pt-6 border-t border-zinc-200">
                    {useCase.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-zinc-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className="text-primary hover:text-primary-hover font-semibold text-sm inline-flex items-center gap-2"
                  >
                    Start free
                    <ArrowRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <PrimaryCta
        title="Ready to get started?"
        description="Start free. Pro and Team add scheduled publishing, more members, and no Inko branding."
        ctaText="Start free"
        ctaLink="/signup"
        secondaryButtonText="See pricing"
        secondaryButtonLink="/pricing"
      />
    </div>
  );
};
