import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Globe, UserSquare2, PanelBottom, Palette, Search, Mail, CreditCard, AtSign, type LucideIcon } from 'lucide-react';
import { useBlog } from '../../../app/providers/BlogProvider';
import type { BlogMembership } from '../../../app/providers/BlogProvider';

type SettingsRole = Extract<BlogMembership['role'], 'owner' | 'editor'>;

interface SettingsSection {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles?: readonly SettingsRole[];
}

interface SettingsGroup {
  label: string;
  sections: readonly SettingsSection[];
}

// Relative to this route (/admin/w/:workspaceSlug/settings). Site settings
// shape the whole blog; Pages are the content of its fixed pages.
const settingsGroups: readonly SettingsGroup[] = [
  {
    label: 'Site',
    sections: [
      { to: 'general', label: 'General', description: 'Address, identity and defaults', icon: Globe, roles: ['owner'] },
      { to: 'branding', label: 'Appearance', description: 'Logo, colors, fonts and layout', icon: Palette, roles: ['owner'] },
      { to: 'seo', label: 'SEO', description: 'Search, sharing and analytics', icon: Search, roles: ['owner'] },
      { to: 'social', label: 'Social profiles', description: 'Links shown across your blog', icon: AtSign, roles: ['owner'] },
    ],
  },
  {
    label: 'Pages',
    sections: [
      { to: 'about', label: 'About', description: 'Your story and call to action', icon: UserSquare2, roles: ['owner'] },
      { to: 'contact', label: 'Contact', description: 'Email, location and FAQ', icon: Mail, roles: ['owner'] },
      { to: 'footer', label: 'Footer', description: 'Footer text and sections', icon: PanelBottom, roles: ['owner'] },
    ],
  },
  {
    label: 'Account',
    sections: [
      { to: 'billing', label: 'Billing', description: 'Plan, payments and invoices', icon: CreditCard, roles: ['owner'] },
    ],
  },
];

export const SettingsLayout = () => {
  const { activeRole } = useBlog();
  const { pathname } = useLocation();
  const mobileNavRef = useRef<HTMLElement>(null);

  // Only what the active role is allowed to see; empty groups are dropped.
  const visibleGroups = settingsGroups
    .map((group) => ({
      ...group,
      sections: group.sections.filter(
        (section) => !section.roles || (activeRole && section.roles.includes(activeRole as SettingsRole))
      ),
    }))
    .filter((group) => group.sections.length > 0);
  const visibleSections = visibleGroups.flatMap((group) => group.sections);

  // Keeps the current tab in view in the scrolling mobile tab row.
  useEffect(() => {
    mobileNavRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          How your blog looks, what its pages say, and how people find it.
        </p>
      </header>

      {/* Mobile: a row of tabs that scrolls sideways, pinned under the app header. */}
      <nav
        ref={mobileNavRef}
        aria-label="Settings sections"
        className="sticky top-14 z-30 -mx-5 overflow-x-auto border-b border-zinc-200 bg-[var(--admin-bg)]/95 px-5 backdrop-blur [scrollbar-width:none] dark:border-zinc-800 lg:hidden"
      >
        <div className="flex gap-1 py-2">
          {visibleSections.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`
              }
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-[1.5rem] border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-20 lg:block lg:self-start">
          <nav aria-label="Settings sections" className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 pt-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.sections.map(({ to, label, description, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        `group flex items-start gap-3 rounded-xl p-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:ring-violet-800/50'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`flex shrink-0 items-center justify-center rounded-lg p-1.5 ${
                              isActive
                                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300'
                                : 'bg-zinc-100 text-zinc-500 group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                          >
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <span className="flex flex-col">
                            <span
                              className={`font-semibold ${isActive ? 'text-violet-900 dark:text-violet-100' : 'text-zinc-700 dark:text-zinc-300'}`}
                            >
                              {label}
                            </span>
                            <span className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">{description}</span>
                          </span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
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
