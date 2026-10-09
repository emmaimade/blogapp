import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, User, X } from 'lucide-react';
import api from '../../../../shared/api/client';
import type { AuditLookup } from './types';

interface EntityPickerProps {
  kind: 'workspace' | 'user';
  /** Selected id, or '' for none. */
  value: string;
  onChange: (id: string) => void;
}

interface Option {
  id: number;
  primary: string;
  secondary: string | null;
}

const toOptions = (kind: EntityPickerProps['kind'], data: AuditLookup | undefined): Option[] =>
  kind === 'workspace'
    ? (data?.workspaces ?? []).map((w) => ({ id: w.id, primary: w.name, secondary: w.slug }))
    : (data?.users ?? []).map((u) => ({ id: u.id, primary: u.name || u.email, secondary: u.name ? u.email : null }));

/**
 * Search-as-you-type picker over /superadmin/audit-logs/lookup. Once
 * something is picked it shows as a removable chip; a value restored from
 * the URL is labelled by looking it up by id.
 */
export const EntityPicker = ({ kind, value, onChange }: EntityPickerProps) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const noun = kind === 'workspace' ? 'workspace' : 'person';
  const Icon = kind === 'workspace' ? Building2 : User;

  useEffect(() => {
    const handle = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(handle);
  }, [text]);

  const { data: results, isFetching } = useQuery<AuditLookup>({
    queryKey: ['superadmin-audit-lookup', kind, term],
    queryFn: async () => (await api.get('/superadmin/audit-logs/lookup', { params: { q: term, kind } })).data,
    enabled: term.length > 0,
    staleTime: 60 * 1000,
  });

  const { data: selected } = useQuery<AuditLookup>({
    queryKey: ['superadmin-audit-lookup-id', kind, value],
    queryFn: async () =>
      (await api.get('/superadmin/audit-logs/lookup', {
        params: kind === 'workspace' ? { blog_id: value } : { user_id: value },
      })).data,
    enabled: !!value,
    staleTime: 5 * 60 * 1000,
  });

  const options = term ? toOptions(kind, results) : [];

  const pick = (option: Option) => {
    onChange(String(option.id));
    setText('');
    setTerm('');
    setOpen(false);
  };

  if (value) {
    const chosen = toOptions(kind, selected)[0];
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-3 pr-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <Icon size={14} aria-hidden="true" className="shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-100" title={chosen?.secondary ?? undefined}>
          {chosen?.primary ?? `${kind === 'workspace' ? 'Workspace' : 'User'} #${value}`}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange('');
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label={`Clear ${noun} filter`}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const activeOption = options[Math.min(active, options.length - 1)];

  return (
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={kind === 'workspace' ? 'Filter by workspace' : 'Filter by person'}
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeOption ? `${listId}-${activeOption.id}` : undefined}
        placeholder={kind === 'workspace' ? 'Any workspace' : 'Anyone'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!options.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % options.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + options.length) % options.length);
          } else if (e.key === 'Enter' && activeOption) {
            e.preventDefault();
            pick(activeOption);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus-visible:ring-zinc-700"
      />
      {open && term && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full min-w-60 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              {isFetching ? 'Searching…' : `No ${noun} matches "${term}".`}
            </li>
          ) : (
            options.map((option) => (
              <li
                key={option.id}
                id={`${listId}-${option.id}`}
                role="option"
                aria-selected={option === activeOption}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(options.indexOf(option))}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  option === activeOption ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
              >
                <span className="block truncate text-zinc-900 dark:text-zinc-100">{option.primary}</span>
                {option.secondary && (
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{option.secondary}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
