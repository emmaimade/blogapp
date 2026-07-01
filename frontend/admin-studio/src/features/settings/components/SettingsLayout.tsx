import { NavLink, Outlet } from 'react-router-dom';
import { Globe, UserSquare2, PanelBottom, Palette, Search, Mail, ScrollText } from 'lucide-react';
import { useBlog } from '../../../app/providers/BlogProvider';

interface SettingsSection {
  to: string;
  label: string;
  description: string;
  icon: any;
  roles?: readonly ('owner' | 'editor')[];
}

const settingsSections: readonly SettingsSection[] = [
  {
    to: '/admin/settings/general',
    label: 'General',
    description: 'Site identity and defaults',
    icon: Globe,
    roles: ['owner'],
  },
  {
    to: '/admin/settings/about',
    label: 'About Page',
    description: 'Bio and contact details',
    icon: UserSquare2,
    roles: ['owner'],
  },
  {
    to: '/admin/settings/footer',
    label: 'Footer',
    description: 'Footer content and links',
    icon: PanelBottom,
    roles: ['owner'],
  },
  {
    to: '/admin/settings/branding',
    label: 'Branding',
    description: 'Colors, logo, and fonts',
    icon: Palette,
    roles: ['owner'],
  },
  {
    to: '/admin/settings/seo',
    label: 'SEO',
    description: 'Metadata and analytics',
    icon: Search,
    roles: ['owner'],
  },
  {
    to: '/admin/settings/contact',
    label: 'Contact',
    description: 'Email, location, response time, social & FAQ',
    icon: Mail,
    roles: ['owner'],
  },
  {
    to: '/admin/settings/activity',
    label: 'Activity log',
    description: 'Workspace audit history',
    icon: ScrollText,
    roles: ['owner', 'editor'],
  },
];

export const SettingsLayout = () => {
  const { activeRole } = useBlog();

  const visibleSections = settingsSections.filter(
    (section) => !section.roles || (activeRole && section.roles.includes(activeRole as any))
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white shadow-lg">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-indigo-900/40 blur-2xl" />
        
        <div className="relative z-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            Workspace Settings
          </p>
          <h1 className="text-3xl font-bold text-white/90 tracking-tight">Configure your blog</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-white/80">
            Manage the public-facing content, branding, and search metadata for your site.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ─── Sidebar Navigation ─── */}
        <aside className="h-fit rounded-[1.75rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 px-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
              Preferences
            </p>
          </div>

          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {visibleSections.map(({ to, label, description, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `group flex min-w-[240px] items-start gap-3 rounded-2xl p-3 text-sm font-medium transition-all duration-200 lg:min-w-0 ${
                    isActive
                      ? 'bg-violet-50 text-violet-900 shadow-sm ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-100 dark:ring-violet-800/50'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-xl p-2 transition-colors duration-200 ${
                        isActive
                          ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300'
                          : 'bg-zinc-100 text-zinc-500 group-hover:bg-white group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700'
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="flex flex-col pt-0.5">
                      <span className={`block font-bold ${isActive ? 'text-violet-900 dark:text-violet-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {label}
                      </span>
                      <span className={`block text-[11px] leading-tight ${isActive ? 'text-violet-600/80 dark:text-violet-300/80' : 'text-zinc-500 dark:text-zinc-500'}`}>
                        {description}
                      </span>
                    </div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ─── Main Content ─── */}
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
};
