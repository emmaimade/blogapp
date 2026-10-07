import { AlertTriangle, RotateCw } from 'lucide-react';

interface LoadErrorProps {
  /** What failed, e.g. "Couldn't load users". */
  title: string;
  onRetry: () => void;
  isRetrying?: boolean;
  /** `card` stands alone on a page; `inline` sits inside an existing card or table. */
  variant?: 'card' | 'inline';
}

/**
 * Shown when a page's data request fails — so a failure reads as a failure
 * with a way to retry, rather than as an empty list ("no users found").
 */
export const LoadError = ({ title, onRetry, isRetrying = false, variant = 'card' }: LoadErrorProps) => (
  <div
    role="alert"
    className={`px-6 py-10 text-center ${
      variant === 'card'
        ? 'rounded-2xl border border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20'
        : ''
    }`}
  >
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
      <AlertTriangle size={18} />
    </div>
    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
    <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
      Check your connection and try again. If it keeps happening, sign out and back in.
    </p>
    <button
      type="button"
      onClick={onRetry}
      disabled={isRetrying}
      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      <RotateCw size={14} className={isRetrying ? 'animate-spin' : ''} />
      Try again
    </button>
  </div>
);
