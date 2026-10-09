import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { useBlog, type BlogMembership } from '../../../app/providers/BlogProvider';
import { planName } from '../../../shared/lib/plans';
import { MAX_OWNED_WORKSPACES, NEW_WORKSPACE_PATH } from '../../../shared/lib/workspacePaths';

// Past this many workspaces the menu gets a filter box.
const SEARCH_THRESHOLD = 5;

interface WorkspaceSwitcherProps {
  /** `sidebar` sits at the top of the desktop sidebar; `header` in the mobile top bar. */
  variant: 'sidebar' | 'header';
  /** Sidebar only: false when the sidebar is collapsed to icons. */
  expanded?: boolean;
  className?: string;
}

const WorkspaceAvatar = ({ name, logoUrl, size }: { name: string; logoUrl?: string | null; size: 'sm' | 'md' }) => {
  const box = size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]';
  return logoUrl ? (
    <img src={logoUrl} alt="" className={`${box} flex-shrink-0 rounded-md object-cover`} />
  ) : (
    <div className={`${box} flex flex-shrink-0 items-center justify-center rounded-md bg-violet-600 font-bold text-white`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const WorkspaceSwitcher = ({ variant, expanded = true, className = '' }: WorkspaceSwitcherProps) => {
  const { memberships, activeBlog, activeRole, switchWorkspace } = useBlog();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const showSearch = memberships.length > SEARCH_THRESHOLD;
  const atWorkspaceLimit =
    memberships.filter((membership) => membership.role === 'owner').length >= MAX_OWNED_WORKSPACES;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? memberships.filter((membership) => membership.blog.name.toLowerCase().includes(needle))
      : memberships;
  }, [memberships, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const activeIndex = memberships.findIndex((membership) => membership.blog.id === activeBlog?.id);
    setHighlighted(Math.max(0, activeIndex));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Opening puts focus where the keyboard can drive the menu.
  useEffect(() => {
    if (open) (showSearch ? searchRef.current : listRef.current)?.focus();
  }, [open, showSearch]);

  if (memberships.length === 0) return null;

  const choose = (membership: BlogMembership) => {
    close();
    switchWorkspace(membership.blog.slug);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && visible[highlighted]) {
      event.preventDefault();
      choose(visible[highlighted]);
    }
  };

  const trigger =
    variant === 'header' ? (
      <button
        onClick={toggle}
        className="flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[15px] font-bold tracking-tight text-zinc-900 transition-colors active:bg-zinc-100 dark:text-white dark:active:bg-zinc-800"
        aria-label="Switch workspace"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{activeBlog?.name ?? 'Select workspace'}</span>
        <ChevronDown size={14} className={`flex-shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
    ) : (
      <button
        onClick={toggle}
        className={`flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 transition-all hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${expanded ? 'px-3 py-2.5' : 'h-10 w-10 justify-center p-0'}`}
        aria-label="Switch workspace"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <WorkspaceAvatar name={activeBlog?.name ?? 'W'} logoUrl={activeBlog?.logo_url} size="md" />
        {expanded && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13px] font-semibold text-zinc-900 dark:text-white">
                {activeBlog?.name ?? 'Select workspace'}
              </div>
              {activeRole && (
                <div className="text-[10px] font-medium capitalize text-zinc-500 dark:text-zinc-400">{activeRole}</div>
              )}
            </div>
            <ChevronDown
              size={14}
              className={`flex-shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>
    );

  const menuPosition =
    variant === 'header'
      ? 'absolute top-full left-4 mt-1 w-72 max-w-[calc(100vw-2rem)]'
      : expanded
        ? 'absolute left-0 right-0 mt-1.5'
        : 'absolute left-full ml-2 top-0 w-64';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {trigger}

      {open && (
        <div
          className={`${menuPosition} z-50 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900`}
          onKeyDown={handleKeyDown}
        >
          <div className="border-b border-zinc-100 px-3.5 pb-2 pt-1.5 dark:border-zinc-800">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Workspaces</div>
            {showSearch && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
                <Search size={14} className="flex-shrink-0 text-zinc-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlighted(0);
                  }}
                  placeholder="Find a workspace"
                  aria-label="Find a workspace"
                  className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                />
              </div>
            )}
          </div>

          <div
            ref={listRef}
            role="listbox"
            aria-label="Workspaces"
            tabIndex={-1}
            className="max-h-72 overflow-y-auto py-1 outline-none"
          >
            {visible.length === 0 && (
              <div className="px-3.5 py-3 text-sm text-zinc-500">No workspace matches “{query}”.</div>
            )}
            {visible.map((membership, index) => {
              const { blog } = membership;
              const isActive = activeBlog?.id === blog.id;
              const needsSetup = blog.onboarding_status !== 'completed';
              // Plans are billing information: only shown to owners (the
              // backend only sends them on owned memberships, too).
              const plan = membership.role === 'owner' ? membership.plan : null;
              return (
                <button
                  key={blog.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => choose(membership)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors ${
                    index === highlighted ? 'bg-zinc-50 dark:bg-zinc-800' : ''
                  }`}
                >
                  <WorkspaceAvatar name={blog.name} logoUrl={blog.logo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">{blog.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>{capitalize(membership.role)}</span>
                      {plan && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-px text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                          {planName(plan)}
                        </span>
                      )}
                      {!blog.is_active && (
                        <span className="rounded-full bg-zinc-200 px-1.5 py-px text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          Suspended
                        </span>
                      )}
                      {needsSetup && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          Setup incomplete
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && <Check size={14} className="flex-shrink-0 text-violet-600" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 px-1.5 pt-1.5 dark:border-zinc-800">
            {atWorkspaceLimit ? (
              <div className="px-2 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                Workspace limit reached ({MAX_OWNED_WORKSPACES} owned)
              </div>
            ) : (
              <Link
                to={NEW_WORKSPACE_PATH}
                onClick={close}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-violet-300 dark:border-violet-700">
                  <Plus size={14} />
                </span>
                New workspace
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
