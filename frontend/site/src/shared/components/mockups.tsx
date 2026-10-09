import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Tag,
  Users,
  Settings,
  ScrollText,
  Search,
  Sun,
  Bell,
  HelpCircle,
  Globe,
  Clock,
  Eye,
  Feather,
  Edit3,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Check,
  ChevronDown,
  CalendarClock,
  Flag,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { InkoLogo } from '../inko';

// Coded illustrations of the studio, for the marketing pages. They're decorative
// (role="img" with a label), use made-up sample content, and mirror the real studio
// (frontend/admin-studio) — keep them in step if the studio's UI changes.

const STATUS_STYLES = {
  Published: 'bg-emerald-50 text-emerald-700',
  Scheduled: 'bg-yellow-50 text-yellow-700',
  Draft: 'bg-zinc-100 text-zinc-600',
} as const;

const StatusBadge = ({ status }: { status: keyof typeof STATUS_STYLES }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>{status}</span>
);

const Avatar = ({ initials, className = 'bg-primary' }: { initials: string; className?: string }) => (
  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${className}`}>
    {initials}
  </span>
);

/** Browser-window chrome around a screenshot or mockup. */
export const BrowserFrame = ({ children, url = 'studio' }: { children: ReactNode; url?: string }) => (
  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-primary/10 ring-1 ring-zinc-900/5">
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <span className="mx-auto hidden rounded-md bg-white px-16 py-1 text-xs text-zinc-400 ring-1 ring-zinc-200 sm:block">{url}</span>
    </div>
    {children}
  </div>
);

// Same structure as the studio's Sidebar for a workspace owner.
const sidebarSections: { heading: string; items: { icon: typeof FileText; label: string; active?: boolean }[] }[] = [
  { heading: 'Overview', items: [{ icon: LayoutDashboard, label: 'Dashboard', active: true }] },
  {
    heading: 'Content',
    items: [
      { icon: FileText, label: 'Posts' },
      { icon: Tag, label: 'Tags' },
      { icon: MessageSquare, label: 'Comments' },
    ],
  },
  {
    heading: 'Management',
    items: [
      { icon: Users, label: 'Team' },
      { icon: ScrollText, label: 'Activity Log' },
      { icon: Settings, label: 'Settings' },
    ],
  },
];

// Same cards as the studio dashboard's StatCard row, with sample numbers.
const stats = [
  { title: 'Total posts', value: '52', sub: '48 live · 1 draft · 3 scheduled', icon: FileText, accent: true },
  { title: 'Live posts', value: '48', sub: 'Published & visible', icon: Globe },
  { title: 'Scheduled', value: '3', sub: 'Will publish automatically', icon: Clock },
  { title: 'Total views', value: '12,480', sub: 'Across all posts', icon: Eye },
  { title: 'Comments', value: '126', sub: 'Reader engagement', icon: MessageSquare },
];

const quickActions = [
  { icon: Feather, label: 'Write new post', desc: 'Start from blank slate', primary: true },
  { icon: Edit3, label: 'Manage posts', desc: 'Edit and publish content' },
];

const card = 'rounded-[1.25rem] border border-zinc-200 bg-white shadow-sm';

/** Replica of the studio dashboard, used in place of a screenshot. */
export const StudioMock = () => (
  <div
    role="img"
    aria-label="The Inko studio dashboard for a workspace, showing post, view and comment totals, publishing rate and quick actions"
    className="relative flex h-[440px] overflow-hidden bg-zinc-50 text-left sm:h-[520px]"
  >
    {/* Sidebar */}
    <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-zinc-200 bg-white px-3 pt-5 md:flex">
      <div className="mb-5 flex items-center gap-2.5 px-1">
        <InkoLogo size={22} />
        <div>
          <div className="text-lg font-bold leading-none tracking-tight text-violet-600">Inko</div>
          <div className="mt-1 font-mono text-[9px] tracking-[0.22em] text-zinc-500">ADMIN STUDIO</div>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-zinc-200 px-2.5 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">N</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-zinc-900">Northwind Journal</div>
          <div className="text-[11px] text-zinc-500">Owner</div>
        </div>
        <ChevronDown size={14} className="text-zinc-400" />
      </div>

      {sidebarSections.map(({ heading, items }) => (
        <div key={heading} className="mb-4">
          <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{heading}</div>
          {items.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-[13px] ${
                active ? 'border-violet-200 bg-violet-50 font-medium text-violet-700' : 'border-transparent text-zinc-700'
              }`}
            >
              <Icon size={16} className={active ? 'text-violet-600' : 'text-zinc-500'} />
              {label}
            </div>
          ))}
        </div>
      ))}
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-3">
        <div className="flex w-full max-w-[15rem] items-center gap-2 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400">
          <Search size={14} />
          <span className="flex-1 truncate">Search posts, comments, …</span>
          <kbd className="rounded border border-zinc-200 px-1 font-mono text-[10px]">/</kbd>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <Sun size={16} className="hidden sm:block" />
          <Bell size={16} />
          <HelpCircle size={16} className="hidden sm:block" />
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">AO</span>
        </div>
      </div>

      {/* Dashboard */}
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xl font-black tracking-tight text-zinc-900">Good morning, Ada</p>
            <p className="text-xs font-medium text-zinc-500">Tuesday, October 14 · Northwind Journal</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Owner</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md">
              <Plus size={14} /> New post
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.map(({ title, value, sub, icon: Icon, accent }, i) => (
            <div
              key={title}
              className={`${card} min-w-0 flex-col gap-3 p-4 ${accent ? 'ring-1 ring-violet-200' : ''} ${
                i > 2 ? 'hidden lg:flex' : 'flex'
              } ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</span>
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl ${
                    accent ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <Icon size={14} />
                </span>
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight tabular-nums text-zinc-900">{value}</div>
                <div className="mt-0.5 text-[11px] font-medium leading-snug text-zinc-500">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={`${card} p-4`}>
          <div className="mb-2.5 flex items-center justify-between text-sm">
            <span className="font-semibold text-zinc-700">Publishing rate</span>
            <span className="font-bold text-zinc-900">92%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-[92%] rounded-full bg-violet-500" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
            <span>48 published</span>
            <span>3 scheduled</span>
            <span>1 draft</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className={`${card} p-4 lg:col-span-3`}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Quick actions</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quickActions.map(({ icon: Icon, label, desc, primary }) => (
                <div
                  key={label}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${
                    primary ? 'border-violet-200 bg-violet-50' : 'border-zinc-100 bg-white'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                      primary ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${primary ? 'text-violet-800' : 'text-zinc-900'}`}>{label}</div>
                    <div className="truncate text-[11px] text-zinc-500">{desc}</div>
                  </div>
                  <ArrowUpRight size={14} className="text-zinc-300" />
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} hidden overflow-hidden lg:col-span-2 lg:block`}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Globe size={14} className="text-violet-500" /> Your blog
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <span className="flex-1 truncate font-mono text-xs font-semibold text-zinc-900">blog.yourbrand.com</span>
                <Copy size={13} className="text-zinc-400" />
                <ExternalLink size={13} className="text-zinc-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Fade out the bottom edge, like a cropped screenshot */}
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
  </div>
);

const workspaces = [
  { name: 'Northwind Journal', initial: 'N', color: 'bg-primary', plan: 'Team', active: true },
  { name: 'Lagos Food Diary', initial: 'L', color: 'bg-amber-500', plan: 'Pro' },
  { name: 'Acme Product Updates', initial: 'A', color: 'bg-teal-500', plan: 'Pro' },
  { name: 'Side Project Notes', initial: 'S', color: 'bg-rose-500', plan: 'Free' },
];

/** The studio's workspace switcher, open. */
export const WorkspaceSwitcherMock = () => (
  <div role="img" aria-label="The workspace switcher listing four blogs, each with its own branding and plan" className="mx-auto w-full max-w-sm text-left">
    <div className="mb-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">N</span>
        <span className="text-sm font-semibold text-zinc-900">Northwind Journal</span>
      </span>
      <ChevronDown size={16} className="rotate-180 text-zinc-400" />
    </div>
    <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-xl shadow-primary/10">
      <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Your workspaces</p>
      {workspaces.map((ws) => (
        <div key={ws.name} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${ws.active ? 'bg-accent' : ''}`}>
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${ws.color}`}>
            {ws.initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{ws.name}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">{ws.plan}</span>
          {ws.active && <Check size={16} className="text-primary" />}
        </div>
      ))}
      <div className="mt-1 flex items-center gap-3 border-t border-zinc-100 px-3 pb-1 pt-3 text-sm font-medium text-primary">
        <Plus size={16} /> New workspace
      </div>
    </div>
  </div>
);

const members = [
  { name: 'Ada Okafor', initials: 'AO', role: 'Owner', color: 'bg-primary', badge: 'bg-amber-100 text-amber-800' },
  { name: 'Tunde Bello', initials: 'TB', role: 'Editor', color: 'bg-teal-500', badge: 'bg-violet-100 text-violet-800' },
  { name: 'Kemi Martins', initials: 'KM', role: 'Author', color: 'bg-rose-500', badge: 'bg-blue-100 text-blue-800' },
  { name: 'Sam Reid', initials: 'SR', role: 'Author', color: 'bg-amber-500', badge: 'bg-blue-100 text-blue-800' },
];

/** A workspace's team list with roles. */
export const RolesMock = () => (
  <div role="img" aria-label="A workspace team with one owner, one editor and two authors" className="w-full rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-xl shadow-primary/5">
    <div className="mb-4 flex items-center justify-between">
      <p className="font-bold text-zinc-900">Team</p>
      <span className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">Invite member</span>
    </div>
    <div className="space-y-1">
      {members.map((m) => (
        <div key={m.name} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
          <Avatar initials={m.initials} className={m.color} />
          <span className="flex-1 text-sm font-medium text-zinc-800">{m.name}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.badge}`}>{m.role}</span>
        </div>
      ))}
    </div>
  </div>
);

const calendarDays = Array.from({ length: 28 }, (_, i) => i + 1);

/** Scheduling a post for a future date. */
export const ScheduleMock = () => (
  <div role="img" aria-label="A post being scheduled to publish on October 14 at 9:00" className="w-full rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-xl shadow-primary/5">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-zinc-500">Post</p>
        <p className="font-bold text-zinc-900">The complete guide to onboarding new clients</p>
      </div>
      <StatusBadge status="Scheduled" />
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <span key={i} className="py-1 font-semibold text-zinc-400">{d}</span>
      ))}
      {calendarDays.map((day) => (
        <span
          key={day}
          className={`rounded-md py-1.5 ${day === 14 ? 'bg-primary font-bold text-white' : day < 9 ? 'text-zinc-300' : 'text-zinc-700'}`}
        >
          {day}
        </span>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm text-accent-text">
      <CalendarClock size={16} />
      Goes live Tue, Oct 14 at 9:00
    </div>
  </div>
);

/** Comments on a post, with one flagged for moderator review. */
export const ModerationMock = () => (
  <div role="img" aria-label="Comments on a post, with one spam comment flagged for review" className="w-full space-y-3 text-left">
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Avatar initials="JD" className="bg-teal-500" />
        <span className="text-sm font-semibold text-zinc-900">Jide D.</span>
        <span className="text-xs text-zinc-400">2h ago</span>
      </div>
      <p className="text-sm text-zinc-600">This checklist saved our team hours. Sharing it with everyone!</p>
    </div>
    <div className="rounded-2xl border-2 border-red-200 bg-white p-4 shadow-xl shadow-red-500/5">
      <div className="mb-2 flex items-center gap-2">
        <Avatar initials="??" className="bg-zinc-400" />
        <span className="text-sm font-semibold text-zinc-900">promo_deals_99</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
          <Flag size={12} /> Flagged
        </span>
      </div>
      <p className="mb-3 text-sm text-zinc-400">Click here for amazing discounts!!!</p>
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">
        <ShieldCheck size={14} /> Sent to moderators for review
      </span>
    </div>
  </div>
);
