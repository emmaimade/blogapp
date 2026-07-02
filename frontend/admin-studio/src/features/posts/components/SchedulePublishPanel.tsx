import { useState, useEffect } from 'react';
import {
  Calendar, Clock, CheckCircle2, FileText,
  Send, X, ChevronDown, AlertCircle, Loader2, RotateCcw,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';

export type PostStatus = 'draft' | 'scheduled' | 'published';

interface SchedulePublishPanelProps {
  status: PostStatus;
  publishedAt?: string | null;
  isSaving?: boolean;
  onSaveDraft:    () => void;
  onPublishNow:   () => void;
  onSchedule:     (publishAt: Date) => void;
  onUnpublish:    () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const toLocalDatetimeValue = (d: Date): string => {
  // Returns "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const defaultScheduleTime = (): string => {
  // Default to tomorrow at 09:00 local time
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalDatetimeValue(d);
};

// ── Status pill ───────────────────────────────────────────────────────────────
const StatusPill = ({ status }: { status: PostStatus }) => {
  const config = {
    draft:     { label: 'Draft',     color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
    scheduled: { label: 'Scheduled', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    published: { label: 'Published', color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>
      {status === 'draft'     && <FileText size={11} />}
      {status === 'scheduled' && <Clock size={11} />}
      {status === 'published' && <CheckCircle2 size={11} />}
      {config.label}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const SchedulePublishPanel = ({
  status,
  publishedAt,
  isSaving = false,
  onSaveDraft,
  onPublishNow,
  onSchedule,
  onUnpublish,
}: SchedulePublishPanelProps) => {
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(defaultScheduleTime);
  const [scheduleError, setScheduleError] = useState('');

  // Pre-fill with existing scheduled time when editing a scheduled post
  useEffect(() => {
    if (status === 'scheduled' && publishedAt) {
      const d = typeof publishedAt === 'string' ? parseISO(publishedAt) : publishedAt;
      setScheduleValue(toLocalDatetimeValue(d));
      setShowScheduler(true);
    }
  }, [status, publishedAt]);

  const handleSchedule = () => {
    setScheduleError('');
    if (!scheduleValue) {
      setScheduleError('Please pick a date and time.');
      return;
    }
    const picked = new Date(scheduleValue);
    if (isPast(picked)) {
      setScheduleError('Scheduled time must be in the future.');
      return;
    }
    onSchedule(picked);
  };

  const parsedPublishedAt = publishedAt
    ? typeof publishedAt === 'string' ? parseISO(publishedAt) : publishedAt
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Publish
        </span>
        <StatusPill status={status} />
      </div>

      <div className="p-4 space-y-3">

        {/* ── PUBLISHED state ──────────────────────────────────────────── */}
        {status === 'published' && (
          <>
            {parsedPublishedAt && (
              <div className="flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2.5">
                <CheckCircle2 size={14} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                    Published {formatDistanceToNow(parsedPublishedAt, { addSuffix: true })}
                  </p>
                  <p className="text-xs text-green-700/70 dark:text-green-400/70 mt-0.5">
                    {format(parsedPublishedAt, 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={onUnpublish}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              Revert to draft
            </button>
          </>
        )}

        {/* ── SCHEDULED state ──────────────────────────────────────────── */}
        {status === 'scheduled' && parsedPublishedAt && (
          <div className="flex items-start gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2.5">
            <Clock size={14} className="text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
                Goes live {formatDistanceToNow(parsedPublishedAt, { addSuffix: true })}
              </p>
              <p className="text-xs text-yellow-700/70 dark:text-yellow-400/70 mt-0.5">
                {format(parsedPublishedAt, 'MMM d, yyyy · h:mm a')}
              </p>
            </div>
          </div>
        )}

        {/* ── DRAFT state ──────────────────────────────────────────────── */}
        {status === 'draft' && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This post is not visible to readers yet.
          </p>
        )}

        {/* ── Schedule date/time picker ─────────────────────────────────── */}
        {(status === 'draft' || status === 'scheduled') && (
          <>
            <button
              type="button"
              onClick={() => setShowScheduler((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              <Calendar size={13} />
              {showScheduler ? 'Hide scheduler' : 'Schedule for later'}
              <ChevronDown
                size={13}
                className={`transition-transform ${showScheduler ? 'rotate-180' : ''}`}
              />
            </button>

            {showScheduler && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-3">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Publish date & time (your local time)
                </label>
                <input
                  type="datetime-local"
                  value={scheduleValue}
                  min={toLocalDatetimeValue(new Date())}
                  onChange={(e) => {
                    setScheduleValue(e.target.value);
                    setScheduleError('');
                  }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                />
                {scheduleError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle size={12} />
                    {scheduleError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={isSaving || !scheduleValue}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSaving
                    ? <><Loader2 size={15} className="animate-spin" /> Scheduling…</>
                    : <><Clock size={15} /> Schedule post</>
                  }
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Primary action buttons ────────────────────────────────────── */}
        <div className="space-y-2 pt-1">
          {/* Save draft — always available except when published */}
          {status !== 'published' && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
            >
              {isSaving
                ? <Loader2 size={15} className="animate-spin" />
                : <FileText size={15} />
              }
              Save draft
            </button>
          )}

          {/* Publish now — available for draft and scheduled */}
          {status !== 'published' && (
            <button
              type="button"
              onClick={onPublishNow}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet/20"
            >
              {isSaving
                ? <><Loader2 size={15} className="animate-spin" /> Publishing…</>
                : <><Send size={15} /> Publish now</>
              }
            </button>
          )}

          {/* Cancel scheduled — converts back to draft */}
          {status === 'scheduled' && (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <X size={13} /> Cancel schedule
            </button>
          )}
        </div>

        {/* Timezone note */}
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
          Times shown in your local timezone. Published on server in UTC.
        </p>
      </div>
    </div>
  );
};