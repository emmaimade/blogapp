/**
 * 
 * Central date formatting utility for INKO admin-studio and blog.
 * All API datetimes are UTC — this file converts them to the
 * user's local timezone before display.
 *
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
 * Time of day to the second, for rows already grouped by day — "14:02:11"
 */
export const formatTimeOfDay = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'HH:mm:ss') : '—';
};

/**
 * Full local datetime to the second, for investigations — "Oct 13, 2026, 14:02:11"
 */
export const formatPreciseDateTime = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'MMM d, yyyy, HH:mm:ss') : '—';
};

/**
 * The same instant in UTC — "2026-10-13T13:02:11.000Z"
 */
export const formatUtcIso = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? d.toISOString() : '—';
};

/**
 * Local calendar day, for grouping — "2026-10-13"
 */
export const localDayKey = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  return d ? format(d, 'yyyy-MM-dd') : '';
};

/**
 * Day heading — "Today · Oct 13", "Yesterday · Oct 12", "Mon, Oct 5, 2026"
 */
export const formatDayHeading = (iso: string | null | undefined): string => {
  const d = safeDate(iso);
  if (!d) return '—';
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const key = format(d, 'yyyy-MM-dd');
  if (key === today) return `Today · ${format(d, 'MMM d')}`;
  if (key === yesterday) return `Yesterday · ${format(d, 'MMM d')}`;
  return format(d, 'EEE, MMM d, yyyy');
};

/**
 * A `datetime-local` input value, shifted by some minutes — "2026-10-13T13:47"
 */
export const toDateTimeLocalValue = (iso: string | null | undefined, offsetMinutes = 0): string => {
  const d = safeDate(iso);
  return d ? format(new Date(d.getTime() + offsetMinutes * 60 * 1000), "yyyy-MM-dd'T'HH:mm") : '';
};

/**
 * Short name of the viewer's timezone — "GMT+1", "EDT"
 */
export const localTimeZoneLabel = (): string => {
  try {
    return (
      new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
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