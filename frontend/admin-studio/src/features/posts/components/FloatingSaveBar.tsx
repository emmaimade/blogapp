import { Loader2, Save } from 'lucide-react';
import type { PostStatus } from './SchedulePublishPanel';

interface FloatingSaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  status: PostStatus;
  onSave: () => void;
}

const SAVE_LABEL: Record<PostStatus, string> = {
  draft: 'Save draft',
  scheduled: 'Save changes',
  published: 'Update live post',
};

/**
 * Appears only while there are unsaved edits, so the editor can be saved
 * from anywhere on a long post — and its absence says the work is saved.
 * The wrapper stays mounted so screen readers hear it appear.
 */
export const FloatingSaveBar = ({ isDirty, isSaving, status, onSave }: FloatingSaveBarProps) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
  >
    {isDirty && (
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-zinc-200 bg-white/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
          Unsaved changes
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isSaving ? 'Saving…' : SAVE_LABEL[status]}
        </button>
      </div>
    )}
  </div>
);
