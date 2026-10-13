import { useId, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Switch } from '../../../shared/ui/Switch';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';

/** Text inputs, textareas and selects on every settings page. */
export const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 placeholder:font-normal placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-violet-500 dark:focus:bg-zinc-800 dark:disabled:bg-zinc-800/50 dark:disabled:text-zinc-500';

export const labelClass = 'block text-sm font-semibold text-zinc-900 dark:text-zinc-200';
export const hintClass = 'text-xs text-zinc-500 dark:text-zinc-400';

/** Props a Field hands its control, so the label, hint and error are announced with it. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** A recommended length, shown as a live count. A guide, not a limit: going over only warns. */
  count?: { length: number; recommended: number };
  /** Beside the label, e.g. a plan badge. */
  aside?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

export const Field = ({ label, hint, error, count, aside, className, children }: FieldProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const isOver = !!count && count.length > count.recommended;
  const describedBy = [error && errorId, hint && hintId, count && countId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {aside}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {(hint || error || count) && (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {error && (
              <p id={errorId} className="text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {hint && (
              <p id={hintId} className={hintClass}>
                {hint}
              </p>
            )}
          </div>
          {count && (
            <p
              id={countId}
              className={`shrink-0 text-xs tabular-nums ${isOver ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'}`}
            >
              {count.length}/{count.recommended}
              {isOver && <span className="sr-only"> characters — longer than recommended, may be cut off</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface SwitchRowProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A labelled on/off setting: text on the left, switch on the right. */
export const SwitchRow = ({ label, description, checked, onChange, disabled }: SwitchRowProps) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className={`mt-0.5 ${hintClass}`}>
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-description` : undefined}
      />
    </div>
  );
};

/** Marks a field that needs a paid plan, and links to Billing. */
export const PaidFeatureBadge = () => {
  const toWorkspace = useWorkspacePath();
  return (
    <Link
      to={toWorkspace('/settings/billing')}
      className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
    >
      <Lock size={10} aria-hidden="true" /> Pro — upgrade
    </Link>
  );
};

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus-visible:ring-offset-zinc-900';
