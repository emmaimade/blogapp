import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { UnsavedChangesDialog } from '../../../shared/components/UnsavedChangesDialog';
import { LoadError } from '../../../shared/ui/LoadError';
import { SettingsSkeleton } from '../../../shared/ui/SettingsSkeleton';
import type { SettingsFormState } from '../hooks/useSettingsForm';

interface SettingsFormProps<T> {
  form: SettingsFormState<T>;
  /** For the load error, e.g. "Couldn't load SEO settings". */
  loadErrorTitle: string;
  skeletonCards?: number;
  /** A row above the sections, e.g. a Preview button. */
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * The frame of a settings page: loading and error states, the sections, the
 * save bar, and the prompt before leaving with unsaved changes. Enter in a
 * text field saves, like any form.
 */
export function SettingsForm<T>({ form, loadErrorTitle, skeletonCards = 3, toolbar, children }: SettingsFormProps<T>) {
  if (form.isLoading) return <SettingsSkeleton cardsCount={skeletonCards} fieldsPerCard={2} />;
  if (form.isError) return <LoadError title={loadErrorTitle} onRetry={form.retry} isRetrying={form.isRetrying} />;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.save();
      }}
      className="max-w-4xl space-y-6"
    >
      <UnsavedChangesDialog blocker={form.blocker} />
      {toolbar}
      {children}
      <SaveBar isDirty={form.isDirty} isSaving={form.isSaving} onDiscard={form.discard} />
    </form>
  );
}

interface SaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  onDiscard: () => void;
}

/**
 * Sticks to the bottom of the screen while there are unsaved changes. It keeps
 * its space when hidden, so the last section never ends up underneath it.
 */
const SaveBar = ({ isDirty, isSaving, onDiscard }: SaveBarProps) => (
  <div
    inert={!isDirty}
    className={`sticky bottom-4 z-30 transition-all duration-200 ${
      isDirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
    }`}
  >
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 py-2.5 pl-4 pr-2.5 shadow-lg backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/95">
      <p role="status" className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-zinc-700 dark:text-zinc-200">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
        {isDirty && (
          <>
            Unsaved<span className="hidden sm:inline">&nbsp;changes</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Discard
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {isSaving && <Loader2 className="animate-spin" size={14} aria-hidden="true" />}
          {isSaving ? 'Saving…' : <>Save<span className="hidden sm:inline">&nbsp;changes</span></>}
        </button>
      </div>
    </div>
  </div>
);
