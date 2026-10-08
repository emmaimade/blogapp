import type { AdminCapability } from '../../auth/lib/accessControl';
import type { AuditLogEntry, FieldChange } from '../types';

const SETTINGS_TABS = new Set(['general', 'about', 'footer', 'branding', 'seo', 'contact']);

/**
 * The before/after per field, from either logged shape:
 * {changes: {field: {from, to}}} or a single {from, to} toggle.
 */
export const getFieldChanges = (log: AuditLogEntry): FieldChange[] => {
  const details = log.details;
  if (!details || typeof details !== 'object') return [];

  if (details.changes && typeof details.changes === 'object') {
    return Object.entries(details.changes).flatMap(([field, change]) =>
      change && typeof change === 'object' && ('from' in change || 'to' in change)
        ? [{ field, from: change.from, to: change.to }]
        : [],
    );
  }
  if ('from' in details && 'to' in details) {
    return [{ field: 'value', from: details.from, to: details.to }];
  }
  return [];
};

export interface EntryLink {
  /** Relative to the workspace root, e.g. `/posts/view/12`. */
  path: string;
  label: string;
}

/**
 * Where an entry points, if it still exists and the viewer can open it.
 * Deleted posts and removed members have nowhere to go.
 */
export const getEntryLink = (
  log: AuditLogEntry,
  can: (capability: AdminCapability) => boolean,
): EntryLink | null => {
  const action = log.action.toLowerCase();
  const id = log.resource_id;

  switch (log.resource_type) {
    case 'post':
      if (!id || action.includes('delete') || !can('manage_posts')) return null;
      return { path: `/posts/view/${id}`, label: 'View post' };
    case 'comment':
      return can('manage_comments') ? { path: '/comments', label: 'View comments' } : null;
    case 'blog_member':
      if (!id || action.includes('remove') || !can('manage_users')) return null;
      return { path: `/users/${id}`, label: 'View member' };
    case 'tag':
      if (action.includes('delete') || !can('manage_tags')) return null;
      return { path: '/tags', label: 'View tags' };
    case 'settings': {
      const tab = action.startsWith('branding.') ? 'branding' : log.details?.key;
      if (!tab || !SETTINGS_TABS.has(tab) || !can('manage_settings')) return null;
      return { path: `/settings/${tab}`, label: 'Open settings' };
    }
    case 'blog':
      return can('manage_settings') ? { path: '/settings/general', label: 'Open settings' } : null;
    case 'subscription':
      return can('manage_settings') ? { path: '/settings/billing', label: 'Open billing' } : null;
    default:
      return null;
  }
};

/** A logged value as display text; null for "nothing there". */
export const formatChangeValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.every((item) => typeof item !== 'object')
      ? value.join(', ')
      : JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export const humanizeField = (field: string) => {
  const words = field.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
