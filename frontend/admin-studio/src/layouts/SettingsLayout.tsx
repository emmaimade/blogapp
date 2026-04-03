import { NavLink, Outlet } from 'react-router-dom';
import { Globe, UserSquare2, PanelBottom, Palette, Search, Mail } from 'lucide-react';

const settingsSections = [
  {
    to: '/admin/settings/general',
    label: 'General',
    description: 'Site identity and defaults',
    icon: Globe,
  },
  {
    to: '/admin/settings/about',
    label: 'About Page',
    description: 'Bio and contact details',
    icon: UserSquare2,
  },
  {
    to: '/admin/settings/footer',
    label: 'Footer',
    description: 'Footer content and links',
    icon: PanelBottom,
  },
  {
    to: '/admin/settings/branding',
    label: 'Branding',
    description: 'Colors, logo, and fonts',
    icon: Palette,
  },
  {
    to: '/admin/settings/seo',
    label: 'SEO',
    description: 'Metadata and analytics',
    icon: Search,
  },
  {
    to: '/admin/settings/contact',
    label: 'Contact',
    description: 'Email, location, response time, social & FAQ',
    icon: Mail,
  },
] as const;

export const SettingsLayout = () => {
  return (
    <div className="space-y-6">
      <div className="admin-glass rounded-[2rem] p-6 text-slate-900 dark:text-white sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">
          Admin Settings
        </p>
        <h1 className="text-3xl font-black tracking-tight">Configure your blog experience</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Manage the public-facing content, branding, and search metadata for your site from one place.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="admin-card h-fit overflow-hidden rounded-[1.75rem] p-4">
          <div className="mb-3 px-2">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
              Sections
            </p>
          </div>

          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-2 lg:overflow-visible lg:px-0 lg:pb-0">
            {settingsSections.map(({ to, label, description, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'sidebar-nav-link group flex min-w-[220px] items-start gap-3 rounded-2xl border px-4 py-4 text-sm font-medium transition-all duration-200 lg:min-w-0',
                    isActive
                      ? 'active border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-900/70'
                      : 'border-transparent text-slate-600 dark:text-slate-300',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'rounded-xl p-2 shadow-sm transition-colors duration-200',
                        isActive
                          ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300'
                          : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:bg-slate-800 dark:group-hover:text-white',
                      ].join(' ')}
                    >
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{label}</span>
                      <span
                        className={[
                          'block text-xs transition-colors duration-200',
                          isActive
                            ? 'text-indigo-600/80 dark:text-indigo-300/80'
                            : 'text-slate-500 dark:text-slate-400 dark:group-hover:text-slate-300',
                        ].join(' ')}
                      >
                        {description}
                      </span>
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
};
