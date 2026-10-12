import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Eye, ExternalLink, MoreHorizontal, RotateCcw, Send, Trash2 } from 'lucide-react';

interface PostActionsMenuProps {
  postTitle: string;
  onEdit: () => void;
  onPreview: () => void;
  /** Live posts only: the post on the public blog. */
  liveUrl?: string;
  /** Drafts only. */
  onPublish?: () => void;
  /** Live posts only. */
  onRevert?: () => void;
  onDelete: () => void;
}

const MENU_WIDTH = 192;
const itemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800';

/**
 * The row's "⋯" menu. It renders in a portal, fixed to the button, because the
 * posts table scrolls sideways and would clip a menu drawn inside it; it opens
 * upwards when there's no room below.
 */
export const PostActionsMenu = ({
  postTitle, onEdit, onPreview, liveUrl, onPublish, onRevert, onDelete,
}: PostActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const fitsBelow = rect.bottom + 6 + menuHeight <= window.innerHeight;
    setPosition({
      top: fitsBelow ? rect.bottom + 6 : rect.top - 6 - menuHeight,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  }, [open]);

  // Focus the first item once the menu is placed — it's hidden while being
  // measured, and a hidden element can't take focus.
  useEffect(() => {
    if (open && position) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // The menu is fixed to where the button was, so it can't follow a scroll.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setPosition(null);
          setOpen((o) => !o);
        }}
        aria-label={`Actions for ${postTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${postTitle}`}
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, width: MENU_WIDTH, visibility: position ? 'visible' : 'hidden' }}
          className="fixed z-50 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 text-sm font-medium shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button role="menuitem" onClick={choose(onEdit)} className={itemClass}>
            <Edit size={14} /> Edit
          </button>
          <button role="menuitem" onClick={choose(onPreview)} className={itemClass}>
            <Eye size={14} /> Preview
          </button>
          {liveUrl && (
            <a role="menuitem" href={liveUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={itemClass}>
              <ExternalLink size={14} /> View on blog
            </a>
          )}
          {(onPublish || onRevert) && <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" role="separator" />}
          {onPublish && (
            <button role="menuitem" onClick={choose(onPublish)} className={itemClass}>
              <Send size={14} /> Publish now…
            </button>
          )}
          {onRevert && (
            <button role="menuitem" onClick={choose(onRevert)} className={itemClass}>
              <RotateCcw size={14} /> Revert to draft…
            </button>
          )}
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" role="separator" />
          <button
            role="menuitem"
            onClick={choose(onDelete)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
          >
            <Trash2 size={14} /> Delete…
          </button>
        </div>,
        document.body,
      )}
    </>
  );
};
