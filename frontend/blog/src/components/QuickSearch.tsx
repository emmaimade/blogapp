import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import api from '../api/blogApi';
import type { PaginatedPosts } from '../types/post';
import { getThumbnailUrl, handleThumbnailError } from '../utils/images';

interface QuickSearchProps {
  /** Lets the navbar collapse its menus when search opens, so the
      overlays never compete for the same space. */
  onOpen?: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

// The "/" and Ctrl/⌘ K shortcuts must not fire while someone is typing a
// comment or filling in the contact form.
const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

export const QuickSearch: React.FC<QuickSearchProps> = ({ onOpen }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery<PaginatedPosts>({
    queryKey: ['quick-search', debouncedQuery],
    queryFn: async () => (await api.get('/posts/search', { params: { q: debouncedQuery, limit: 5 } })).data,
    enabled: open && debouncedQuery.length > 1,
    staleTime: 30 * 1000,
  });
  const results = (data?.items ?? []).slice(0, 5);
  const showDropdown = open && debouncedQuery.length > 1;

  // Global shortcuts: Ctrl/⌘ K and "/" open search from anywhere.
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const isCommandK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isCommandK && !isSlash) return;
      e.preventDefault();
      setOpen(true);
      onOpen?.();
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [onOpen]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openSearch = () => {
    setOpen(true);
    onOpen?.();
  };

  const closeSearch = () => {
    setOpen(false);
    setQuery('');
  };

  const submitSearch = () => {
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    closeSearch();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch();
  };

  // Up/Down move between the input and the results; Up from the first
  // result returns to the input.
  const focusResult = (index: number) => {
    if (index < 0) {
      inputRef.current?.focus();
      return;
    }
    resultRefs.current[Math.min(index, results.length - 1)]?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      focusResult(0);
    }
  };

  const handleResultKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusResult(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusResult(index - 1);
    }
  };

  if (!open) {
    return (
      <>
        <button
          onClick={openSearch}
          className="lg:hidden p-2 rounded-lg text-zinc-500 hover:text-primary hover:bg-zinc-100 transition dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        {/* Desktop: looks like a search field, with its shortcut, so it's found without hunting for an icon */}
        <button
          onClick={openSearch}
          aria-label="Search posts"
          aria-keyshortcuts="Control+K Meta+K /"
          className="hidden lg:inline-flex w-56 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
        >
          <Search size={16} aria-hidden="true" />
          <span className="flex-1 text-left">Search posts…</span>
          <kbd className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </>
    );
  }

  // Below `sm` the open search is a full-width bar under the navbar, with
  // results beneath it, so nothing is squeezed into the top row. From `sm` up
  // it opens in place, and the results are positioned against the navbar's
  // own (relative) row, right-aligned to its content edge.
  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-16 z-40 border-b border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:dark:bg-transparent"
    >
      <form onSubmit={handleSubmit} role="search" className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search posts..."
          aria-label="Search posts"
          className="w-full sm:w-56 lg:w-64 pl-9 pr-8 py-2 rounded-xl border border-zinc-300 bg-white text-sm outline-none focus:border-primary transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Close search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X size={14} />
        </button>
      </form>

      {showDropdown && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 sm:absolute sm:right-6 sm:top-full sm:z-50 sm:mt-2 sm:w-80">
          {isFetching ? (
            <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">Searching…</div>
          ) : results.length > 0 ? (
            <>
              <ul>
                {results.map((post, index) => (
                  <li key={post.id}>
                    <Link
                      ref={(el) => {
                        resultRefs.current[index] = el;
                      }}
                      to={`/post/${post.slug}`}
                      onClick={closeSearch}
                      onKeyDown={handleResultKeyDown(index)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 focus:bg-zinc-50 outline-none transition-colors border-b border-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 dark:border-zinc-800"
                    >
                      <img
                        src={getThumbnailUrl(post.thumbnail_url, 80)}
                        onError={handleThumbnailError}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-zinc-100 dark:bg-zinc-800"
                      />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">{post.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={submitSearch}
                className="w-full text-left px-4 py-3 text-sm font-bold text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                See all results for &ldquo;{query}&rdquo;
              </button>
            </>
          ) : (
            <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No posts found for &ldquo;{query}&rdquo;</div>
          )}
        </div>
      )}
    </div>
  );
};
