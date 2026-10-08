export interface ValueChange {
  from?: unknown;
  to?: unknown;
}

/** The logged `details` blob; shapes vary by action, these are the ones the UI reads. */
export interface AuditLogDetails {
  changes?: Record<string, ValueChange | undefined>;
  from?: unknown;
  to?: unknown;
  /** Settings section, for settings.updated. */
  key?: string;
  commenter_role?: string;
  [extra: string]: unknown;
}

export interface AuditLogEntry {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_name?: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  description: string | null;
  details?: AuditLogDetails | null;
  created_at: string;
}

export interface AuditLogActor {
  user_id: number;
  email: string | null;
  name: string | null;
}

export interface AuditLogFilters {
  /** How far back the workspace's plan lets it see; null when unlimited. */
  history_days: number | null;
  actors: AuditLogActor[];
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}
