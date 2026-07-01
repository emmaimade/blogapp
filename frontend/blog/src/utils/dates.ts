/**
 * 
 * Central date formatting utility for INKO admin-studio and blog.
 * All API datetimes are UTC — this file converts them to the
 * user's local timezone before display.
 *
 * Usage:
 *   import { formatLocalDateTime, formatRelative, formatSmart } from '@/shared/utils/dates';
 */

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

/**
 * Safely parse an ISO datetime string from the API.
 * Appends 'Z' if no timezone offset is present so the browser
 * always treats it as UTC, never as local time.
 */
const parseApiDate = (iso: string): Date => {
  // Already has timezone info (Z, +00:00, +01:00 etc.) — parse as-is
  if (/[Z]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return parseISO(iso);
  }
  // No timezone info — backend sent naive UTC datetime, force UTC
  return parseISO(iso + 'Z');
};

const safeDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  try {
    const d = parseApiDate(iso);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
};

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Full local datetime — "Jun 18, 2026 · 9:00 AM"
 */
export const formatLocalDateTime = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'MMM d, yyyy · h:mm a') : '—';
};

/**
 * Local date only — "Jun 18, 2026"
 */
export const formatLocalDate = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'MMM d, yyyy') : '—';
};

/**
 * Short local date — "Jun 18"
 */
export const formatShortDate = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'MMM d') : '—';
};

/**
 * Relative time — "3 hours ago" / "in 2 days"
 */
export const formatRelative = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—';
};

/**
 * Smart display:
 * - Within 7 days → relative ("2 days ago")
 * - Older → absolute ("Jun 11, 2026")
 */
export const formatSmart = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  if (!d) return '—';
  const diffMs = Math.abs(Date.now() - d.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < 7
    ? formatDistanceToNow(d, { addSuffix: true })
    : format(d, 'MMM d, yyyy');
};

/**
 * Scheduled post display — "Jun 20, 2026 at 9:00 AM"
 */
export const formatScheduled = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, "MMM d, yyyy 'at' h:mm a") : '—';
};

/**
 * Compact timestamp for audit logs — "18 Jun, 09:00"
 */
export const formatAuditTs = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'd MMM, HH:mm') : '—';
};

/**
 * Convert a local Date object to an ISO string for API submission.
 * Always sends UTC so the backend stores it correctly.
 */
export const toApiDateTime = (date: Date): string => {
  return date.toISOString(); // always UTC with Z suffix
};

/**
 * Detect the user's local IANA timezone string.
 * e.g. "Africa/Lagos", "America/New_York", "Europe/London"
 * Used to pre-fill the timezone field during onboarding.
 */
export const detectUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};