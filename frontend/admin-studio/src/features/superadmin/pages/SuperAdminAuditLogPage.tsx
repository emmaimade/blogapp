import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Clock,
  Database,
  Download,
  FileText,
  Filter,
  KeyRound,
  Network,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import api from '../../../shared/api/client';
import { formatLocalDateTime, formatRelative } from '../../../shared/utils/dates';

interface AuditLogEntry {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  actor: string | null;
  action: string;
  resource_type: string;
  target_type: string | null;
  resource_id: number | null;
  blog_id: number | null;
  details: Record<string, unknown> | null;
  description: string | null;
  ip_address: string | null;
  user_agent?: string | null;
  created_at: string;
}

type Severity = 'info' | 'warning' | 'critical';
type Category = 'all' | 'auth' | 'tenants' | 'users' | 'settings' | 'content' | 'moderation' | 'system';

interface ActionMeta {
  label: string;
  category: Exclude<Category, 'all'>;
  severity: Severity;
  icon: ReactNode;
}

const PAGE_SIZE = 100;

const ACTION_META: Record<string, ActionMeta> = {
  'user.login': { label: 'User Login', category: 'auth', severity: 'info', icon: <KeyRound size={14} /> },
  'user.register': { label: 'User Registered', category: 'users', severity: 'info', icon: <User size={14} /> },
  'user.update_profile': { label: 'Profile Updated', category: 'users', severity: 'info', icon: <User size={14} /> },
  'user.delete_account': { label: 'Account Deleted', category: 'users', severity: 'critical', icon: <Trash2 size={14} /> },
  'blog.create': { label: 'Workspace Created', category: 'tenants', severity: 'info', icon: <Building2 size={14} /> },
  'blog.update': { label: 'Workspace Updated', category: 'tenants', severity: 'info', icon: <Building2 size={14} /> },
  'blog.member_add': { label: 'Workspace Member Added', category: 'users', severity: 'warning', icon: <User size={14} /> },
  'blog.member_remove': { label: 'Workspace Member Removed', category: 'users', severity: 'warning', icon: <User size={14} /> },
  'blog.member_permissions_update': { label: 'Workspace Permissions Updated', category: 'users', severity: 'warning', icon: <ShieldCheck size={14} /> },
  'post.created': { label: 'Post Created', category: 'content', severity: 'info', icon: <FileText size={14} /> },
  'post.updated': { label: 'Post Updated', category: 'content', severity: 'info', icon: <FileText size={14} /> },
  'post.deleted': { label: 'Post Deleted', category: 'content', severity: 'critical', icon: <Trash2 size={14} /> },
  'comment.delete': { label: 'Comment Deleted', category: 'moderation', severity: 'warning', icon: <Trash2 size={14} /> },
  'moderation.approve': { label: 'Moderation Approved', category: 'moderation', severity: 'info', icon: <ShieldCheck size={14} /> },
  'moderation.reject': { label: 'Moderation Rejected', category: 'moderation', severity: 'warning', icon: <AlertTriangle size={14} /> },
  'moderation.remove': { label: 'Content Removed', category: 'moderation', severity: 'critical', icon: <Trash2 size={14} /> },
  'settings.updated': { label: 'Workspace Settings Updated', category: 'settings', severity: 'info', icon: <Settings size={14} /> },
  'branding.updated': { label: 'Branding Updated', category: 'settings', severity: 'info', icon: <Settings size={14} /> },
  'superadmin.blog_status_update': { label: 'Workspace Status Changed', category: 'tenants', severity: 'warning', icon: <Building2 size={14} /> },
  'superadmin.blog_delete': { label: 'Workspace Deleted', category: 'tenants', severity: 'critical', icon: <Trash2 size={14} /> },
  'superadmin.user_status_update': { label: 'User Status Changed', category: 'users', severity: 'warning', icon: <User size={14} /> },
  'superadmin.user_delete': { label: 'User Deleted', category: 'users', severity: 'critical', icon: <Trash2 size={14} /> },
  'superadmin.platform_settings_update': { label: 'Platform Settings Updated', category: 'settings', severity: 'critical', icon: <Settings size={14} /> },
};

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'auth', label: 'Auth' },
  { value: 'tenants', label: 'Tenants' },
  { value: 'users', label: 'Users' },
  { value: 'settings', label: 'Settings' },
  { value: 'content', label: 'Content' },
  { value: 'moderation', label: 'Moderation' },
  { value: 'system', label: 'System' },
];

const severityClass: Record<Severity, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
};

const iconClass: Record<Severity, string> = {
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300',
  critical: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300',
};

const getActionMeta = (log: AuditLogEntry): ActionMeta => {
  if (ACTION_META[log.action]) return ACTION_META[log.action];
  if (log.action.startsWith('http.')) {
    return { label: log.action.toUpperCase(), category: 'system', severity: 'info', icon: <Network size={14} /> };
  }
  if (log.action.includes('delete') || log.action.includes('remove')) {
    return { label: humanize(log.action), category: 'system', severity: 'critical', icon: <Trash2 size={14} /> };
  }
  if (log.action.includes('status') || log.action.includes('permission')) {
    return { label: humanize(log.action), category: 'system', severity: 'warning', icon: <AlertTriangle size={14} /> };
  }
  return { label: humanize(log.action), category: 'system', severity: 'info', icon: <ShieldCheck size={14} /> };
};

const humanize = (value: string) =>
  value
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const stringifyDetail = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const exportCsv = (logs: AuditLogEntry[]) => {
  const rows = logs.map((log) => [
    log.id,
    log.created_at,
    log.action,
    log.resource_type,
    log.resource_id,
    log.blog_id,
    log.actor_email,
    log.actor_user_id,
    log.ip_address,
    log.description,
    JSON.stringify(log.details ?? {}),
  ]);
  const csv = [
    ['id', 'created_at', 'action', 'resource_type', 'resource_id', 'blog_id', 'actor_email', 'actor_user_id', 'ip_address', 'description', 'details'],
    ...rows,
  ]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inko-platform-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const SuperAdminAuditLogPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [blogIdFilter, setBlogIdFilter] = useState('');
  const [actorIdFilter, setActorIdFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['superadmin-audit-logs', page, actionFilter, blogIdFilter, actorIdFilter],
    queryFn: async () => {
      const res = await api.get('/superadmin/audit-logs', {
        params: {
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          action: actionFilter !== 'all' ? actionFilter : undefined,
          blog_id: blogIdFilter.trim() ? Number(blogIdFilter) : undefined,
          actor_user_id: actorIdFilter.trim() ? Number(actorIdFilter) : undefined,
        },
      });
      return res.data;
    },
  });

  const actionOptions = useMemo(
    () => Array.from(new Set([...Object.keys(ACTION_META), ...logs.map((log) => log.action)])).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const meta = getActionMeta(log);
      const matchesCategory = categoryFilter === 'all' || meta.category === categoryFilter;
      const matchesSeverity = severityFilter === 'all' || meta.severity === severityFilter;
      const matchesSearch =
        !term ||
        log.action.toLowerCase().includes(term) ||
        meta.label.toLowerCase().includes(term) ||
        log.description?.toLowerCase().includes(term) ||
        log.actor_email?.toLowerCase().includes(term) ||
        log.resource_type.toLowerCase().includes(term) ||
        String(log.resource_id ?? '').includes(term) ||
        String(log.blog_id ?? '').includes(term) ||
        log.ip_address?.toLowerCase().includes(term);

      return matchesCategory && matchesSeverity && matchesSearch;
    });
  }, [categoryFilter, logs, search, severityFilter]);

  const metrics = useMemo(() => {
    const critical = filteredLogs.filter((log) => getActionMeta(log).severity === 'critical').length;
    const warning = filteredLogs.filter((log) => getActionMeta(log).severity === 'warning').length;
    const superadmin = filteredLogs.filter((log) => log.action.startsWith('superadmin.')).length;
    const uniqueActors = new Set(filteredLogs.map((log) => log.actor_email).filter(Boolean)).size;
    return { critical, warning, superadmin, uniqueActors };
  }, [filteredLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Platform Audit Log</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Cross-tenant forensic trail for privileged actions, security-sensitive changes, and operational events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCsv(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Database size={16} />} label="Visible Events" value={filteredLogs.length} tone="zinc" />
        <MetricCard icon={<AlertTriangle size={16} />} label="Critical Events" value={metrics.critical} tone="red" />
        <MetricCard icon={<ShieldCheck size={16} />} label="Superadmin Actions" value={metrics.superadmin} tone="amber" />
        <MetricCard icon={<User size={16} />} label="Unique Actors" value={metrics.uniqueActors} tone="blue" />
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
          <Filter size={14} /> Filters
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.4fr)_repeat(5,minmax(130px,1fr))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search actor, action, IP, resource..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-700"
            />
          </div>

          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as Category)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as 'all' | Severity)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(0); }} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <option value="all">All Actions</option>
            {actionOptions.map((action) => <option key={action} value={action}>{humanize(action)}</option>)}
          </select>

          <input value={blogIdFilter} onChange={(event) => { setBlogIdFilter(event.target.value.replace(/\D/g, '')); setPage(0); }} placeholder="Blog ID" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
          <input value={actorIdFilter} onChange={(event) => { setActorIdFilter(event.target.value.replace(/\D/g, '')); setPage(0); }} placeholder="Actor ID" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[44px_minmax(220px,1.4fr)_minmax(160px,1fr)_120px_120px_140px] gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60">
          <span />
          <span>Event</span>
          <span>Actor</span>
          <span>Tenant</span>
          <span>Resource</span>
          <span>Time</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">Loading platform audit events...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldCheck size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500">No audit entries match these filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {filteredLogs.map((log) => {
              const meta = getActionMeta(log);
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="grid w-full grid-cols-[44px_minmax(220px,1.4fr)_minmax(160px,1fr)_120px_120px_140px] items-center gap-3 px-4 py-4 text-left transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass[meta.severity]}`}>
                      {meta.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{meta.label}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass[meta.severity]}`}>
                          {meta.severity}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">{log.description || log.action}</span>
                    </span>
                    <span className="min-w-0 text-xs text-zinc-600 dark:text-zinc-300">
                      <span className="block truncate font-medium">{log.actor_email || log.actor || 'System'}</span>
                      {log.actor_user_id && <span className="text-[11px] text-zinc-400">ID {log.actor_user_id}</span>}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{log.blog_id ? `Blog #${log.blog_id}` : 'Platform'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {log.resource_type}
                      {log.resource_id ? ` #${log.resource_id}` : ''}
                    </span>
                    <span className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span title={formatLocalDateTime(log.created_at)}>{formatRelative(log.created_at)}</span>
                      <ChevronDown size={14} className={`transition ${isExpanded ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {isExpanded && <ExpandedLog log={log} meta={meta} />}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-400">
            Showing {filteredLogs.length} of {logs.length} fetched events. Page {page + 1}.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0 || isLoading}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((value) => value + 1)}
              disabled={logs.length < PAGE_SIZE || isLoading}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: 'zinc' | 'red' | 'amber' | 'blue' }) => {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300',
  };

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
};

const ExpandedLog = ({ log, meta }: { log: AuditLogEntry; meta: ActionMeta }) => {
  const detailEntries = Object.entries(log.details ?? {});

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-5 dark:border-zinc-900 dark:bg-zinc-900/30">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{meta.label}</p>
              <p className="mt-0.5 font-mono text-xs text-zinc-400">{log.action}</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass[meta.severity]}`}>
              {meta.category}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Actor" value={log.actor_email || log.actor || 'System'} />
            <DetailItem label="Actor ID" value={log.actor_user_id ?? 'None'} />
            <DetailItem label="Tenant Scope" value={log.blog_id ? `Blog #${log.blog_id}` : 'Platform'} />
            <DetailItem label="Resource" value={`${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ''}`} />
            <DetailItem label="IP Address" value={log.ip_address || 'Not captured'} />
            <DetailItem label="Created" value={formatLocalDateTime(log.created_at)} />
          </div>
          {log.user_agent && (
            <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">User Agent</p>
              <p className="break-words font-mono text-xs text-zinc-600 dark:text-zinc-300">{log.user_agent}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={14} className="text-zinc-400" />
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Event Details</p>
          </div>
          {detailEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
              No structured details were attached to this event.
            </p>
          ) : (
            <div className="space-y-2">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{humanize(key)}</p>
                  <p className="break-words font-mono text-xs text-zinc-700 dark:text-zinc-300">{stringifyDetail(value)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100 dark:bg-black">
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(log, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{label}</p>
    <p className="break-words text-xs font-semibold text-zinc-700 dark:text-zinc-300">{value}</p>
  </div>
);
