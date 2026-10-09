import type { AuditLogDetails } from '../../../audit-log/types';

export type Severity = 'critical' | 'warning' | 'info';

export interface PlatformAuditEntry {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  /** From the backend's action catalog. */
  label: string;
  category: string;
  severity: Severity;
  resource_type: string;
  resource_id: number | null;
  blog_id: number | null;
  blog_name: string | null;
  resource_label: string | null;
  details: AuditLogDetails | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditSummary {
  total: number;
  by_severity: Record<Severity, number>;
}

export interface LookupWorkspace {
  id: number;
  name: string;
  slug: string;
}

export interface LookupUser {
  id: number;
  name: string | null;
  email: string;
}

export interface AuditLookup {
  workspaces: LookupWorkspace[];
  users: LookupUser[];
}

export const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'auth', label: 'Sign-in & passwords' },
  { value: 'users', label: 'Accounts' },
  { value: 'workspaces', label: 'Workspaces' },
  { value: 'team', label: 'Workspace teams' },
  { value: 'content', label: 'Content' },
  { value: 'moderation', label: 'Moderation' },
  { value: 'settings', label: 'Settings' },
  { value: 'billing', label: 'Billing' },
  { value: 'support', label: 'Support' },
  { value: 'other', label: 'Other' },
];

export const RANGE_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range…' },
];

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/** Everything the URL can say about the current view. */
export interface AuditFilters {
  q: string;
  category: string;
  severity: string;
  workspace: string;
  actor: string;
  action: string;
  range: string;
  /** `datetime-local` values, used when range is "custom". */
  from: string;
  to: string;
  logins: boolean;
}

export const FILTER_KEYS = ['q', 'category', 'severity', 'workspace', 'actor', 'action', 'range', 'from', 'to', 'logins'] as const;

export const readFilters = (params: URLSearchParams): AuditFilters => ({
  q: params.get('q') ?? '',
  category: params.get('category') ?? '',
  severity: params.get('severity') ?? '',
  workspace: params.get('workspace') ?? '',
  actor: params.get('actor') ?? '',
  action: params.get('action') ?? '',
  range: params.get('range') ?? '',
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  logins: params.get('logins') === '1',
});

const localToIso = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** API query params for the filters; relative ranges resolve against now. */
export const toApiParams = (filters: AuditFilters) => {
  const relative = RANGE_MS[filters.range];
  return {
    search: filters.q || undefined,
    category: filters.category || undefined,
    severity: filters.severity || undefined,
    blog_id: filters.workspace || undefined,
    actor_user_id: filters.actor || undefined,
    action: filters.action || undefined,
    include_logins: filters.logins || undefined,
    since: relative
      ? new Date(Date.now() - relative).toISOString()
      : filters.range === 'custom'
        ? localToIso(filters.from)
        : undefined,
    until: filters.range === 'custom' ? localToIso(filters.to) : undefined,
  };
};
