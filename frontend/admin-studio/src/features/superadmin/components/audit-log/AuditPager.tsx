import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CalendarClock } from 'lucide-react';

interface AuditPagerProps {
  /** "Newest 50 of 1,284 entries" and the like. */
  status: string;
  onNewestPage: boolean;
  hasNewer: boolean;
  hasOlder: boolean;
  disabled: boolean;
  onNewest: () => void;
  onNewer: () => void;
  onOlder: () => void;
  /** A `datetime-local` value, in the viewer's time. */
  jumpedTo: string;
  onJump: (localValue: string) => void;
  /** The bottom pager opens its popover upwards, so it stays on screen. */
  placement: 'top' | 'bottom';
  className?: string;
}

/**
 * Newer / Older paging plus "Jump to date", shown above and below the log.
 * Jumping is a position, not a filter: the list carries on past the moment
 * picked, which is why it lives here and not with the filters.
 */
export const AuditPager = ({
  status,
  onNewestPage,
  hasNewer,
  hasOlder,
  disabled,
  onNewest,
  onNewer,
  onOlder,
  jumpedTo,
  onJump,
  placement,
  className = '',
}: AuditPagerProps) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(jumpedTo);
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLFormElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Close on a click outside; Escape is handled on the form.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value) return;
    onJump(value);
    close();
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p>
      <nav aria-label="Pages" className="relative flex flex-wrap items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setValue(jumpedTo);
            setOpen((isOpen) => !isOpen);
          }}
          aria-expanded={open}
          aria-controls={popoverId}
          className={`${pagerButtonClass} inline-flex items-center gap-1.5`}
        >
          <CalendarClock size={13} aria-hidden="true" />
          Jump to date
        </button>
        {!onNewestPage && (
          <button type="button" onClick={onNewest} disabled={disabled} className={pagerButtonClass}>
            Newest
          </button>
        )}
        <button type="button" onClick={onNewer} disabled={!hasNewer || disabled} className={pagerButtonClass}>
          ← Newer
        </button>
        <button type="button" onClick={onOlder} disabled={!hasOlder || disabled} className={pagerButtonClass}>
          Older →
        </button>

        {open && (
          <form
            ref={popoverRef}
            id={popoverId}
            onSubmit={submit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              }
            }}
            className={`absolute right-0 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${
              placement === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Show entries from
              <input
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </label>
            <p className="mt-1.5 text-[11px] text-zinc-400">Your local time. Older entries follow; filters stay as they are.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={close} className={pagerButtonClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={!value}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50"
              >
                Go
              </button>
            </div>
          </form>
        )}
      </nav>
    </div>
  );
};

const pagerButtonClass =
  'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800';
