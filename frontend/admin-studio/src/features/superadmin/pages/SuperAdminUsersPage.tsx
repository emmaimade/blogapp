import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, MoreHorizontal, CheckCircle2, XCircle, Trash2, RotateCcw, User as UserIcon, ShieldCheck, Users } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/context/AuthContext';
import type { BlogRole, PlatformRole } from '../../auth/types';
import { formatLocalDate, formatLocalDateTime, formatSmart } from '../../../shared/utils/dates';
import { Modal } from '../../../shared/components/Modal';
import { SkeletonBar, SkeletonListRow } from '../../../shared/ui/Skeleton';
import { Spinner } from '../../../shared/ui/Spinner';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { toastApiError } from '../../../shared/lib/apiErrors';
import api from '../../../shared/api/client';
import { LoadError } from '../../../shared/ui/LoadError';
import { Avatar, ROLE_META } from '../../users/components/UserComponents';

type AccountStatus = 'all' | 'active' | 'suspended' | 'deleted';

interface PlatformUser {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  platform_role: PlatformRole;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  deleted_at: string | null;
  blog_memberships: { id: number; blog_id: number; role: BlogRole; blog: { id: number; name: string } }[];
}

interface UserListPage {
  items: PlatformUser[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
  counts: Record<AccountStatus, number>;
}

const PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
// Mirrors SOFT_DELETE_RETENTION_DAYS in backend/app/services/deletion.py.
const SOFT_DELETE_RETENTION_DAYS = 30;

const STATUS_TABS: { key: AccountStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'deleted', label: 'Deleted' },
];

// Columns shared by the desktop header and each row (rows use subgrid).
const GRID_COLS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8.5rem_7rem_3rem]';

// Superadmin deletes rename the account to free its username/email; show the
// original identity instead of "deleted_12_…".
const identityOf = (user: PlatformUser) => {
  const prefix = `deleted_${user.id}_`;
  const strip = (value: string | null) =>
    value && user.deleted_at && value.startsWith(prefix) ? value.slice(prefix.length) : value;
  const username = strip(user.username);
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || (username ? `@${username}` : 'Unnamed account');
  return { username, email: strip(user.email) ?? user.email, name };
};

const restoreDeadline = (deletedAt: string) => new Date(deletedAt).getTime() + SOFT_DELETE_RETENTION_DAYS * DAY_MS;

const purgeLabel = (deletedAt: string, now: number) => {
  const days = Math.ceil((restoreDeadline(deletedAt) - now) / DAY_MS);
  if (days <= 0) return 'Purge pending';
  return `Purges in ${days} ${days === 1 ? 'day' : 'days'}`;
};

const workspaceSummary = (user: PlatformUser) => {
  const names = user.blog_memberships.map((m) => m.blog.name);
  if (names.length === 0) return 'No workspace';
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
};

const Pill = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none ${className}`}>
    {children}
  </span>
);

const UsersSkeleton = () => (
  <div className="p-4 sm:p-6 max-w-full sm:max-w-400 mx-auto space-y-5">
    <div className="space-y-2">
      <SkeletonBar className="h-7 w-48" />
      <SkeletonBar className="h-4 w-28" />
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <SkeletonBar className="h-11 sm:h-10 w-full sm:max-w-md rounded-lg" />
      <SkeletonBar className="h-11 sm:h-10 w-full sm:w-56 rounded-lg" />
    </div>
    <div className="flex gap-2">
      {[...Array(4)].map((_, i) => <SkeletonBar key={i} className="h-9 w-24 rounded-full" />)}
    </div>
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
      {[...Array(8)].map((_, i) => <SkeletonListRow key={i} />)}
    </div>
  </div>
);

type MenuItem =
  | { kind: 'link'; label: string; to: string; icon: ReactNode }
  | { kind: 'button'; label: string; icon: ReactNode; danger?: boolean; onSelect: () => void };

export const SuperAdminUsersPage = () => {
  useDocumentTitle('Platform users');
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());

  // Filters live in the URL so refresh, back/forward and shared links keep them.
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status');
  const status: AccountStatus = STATUS_TABS.some((t) => t.key === statusParam) ? (statusParam as AccountStatus) : 'all';
  const workspace = searchParams.get('workspace') ?? '';
  const hasFilters = !!(q || workspace);

  const updateParams = (changes: Record<string, string>, replace = false) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value && value !== 'all') next.set(key, value);
          else next.delete(key);
        });
        return next;
      },
      { replace },
    );

  // Debounced into the URL; reset when the URL changes underneath it.
  const [searchInput, setSearchInput] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setSearchInput(q);
  }
  useEffect(() => {
    const next = searchInput.trim();
    if (next === q) return;
    const handle = setTimeout(() => updateParams({ q: next }, true), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, q]);

  const { data: workspaces = [] } = useQuery<{ blog_id: number; name: string }[]>({
    queryKey: ['superadmin-blogs'],
    queryFn: async () => (await api.get('/superadmin/blogs')).data,
    staleTime: 5 * 60 * 1000,
  });
  const workspaceOptions = useMemo(() => [...workspaces].sort((a, b) => a.name.localeCompare(b.name)), [workspaces]);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['superadmin-users', status, workspace, q],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<UserListPage>('/superadmin/users', {
          params: { skip: pageParam, limit: PAGE_SIZE, status, blog_id: workspace || undefined, search: q || undefined },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.skip + last.limit : undefined),
    placeholderData: keepPreviousData,
  });

  const users = useMemo(() => {
    // Offsets can shift if accounts change between pages; drop repeats.
    const seen = new Set<number>();
    return (data?.pages ?? []).flatMap((p) => p.items).filter((u) => !seen.has(u.id) && !!seen.add(u.id));
  }, [data]);
  const firstPage = data?.pages[0];
  const counts = firstPage?.counts;
  const total = firstPage?.total ?? 0;

  // ── Actions ────────────────────────────────────────────────────────────
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    action: () => void;
  } | null>(null);

  // The desktop popover and the mobile sheet are both mounted (CSS picks one),
  // so an outside click has to miss both before it closes the menu.
  useEffect(() => {
    if (menuFor === null) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuFor(null);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    const lockScroll = window.matchMedia('(max-width: 767px)').matches;
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      if (lockScroll) document.body.style.overflow = prevOverflow;
    };
  }, [menuFor]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => api.patch(`/superadmin/users/${id}`, { is_active }),
    onSuccess: (_, { is_active }) => {
      invalidate();
      toast.success(is_active ? 'Account reactivated' : 'Account suspended');
    },
    onError: (error) => toastApiError(error, 'Failed to update the account.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/superadmin/users/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Account deleted. You can restore it from the Deleted tab.');
    },
    onError: (error) => toastApiError(error, 'Failed to delete the account.'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.post(`/superadmin/users/${id}/restore`),
    onSuccess: () => {
      invalidate();
      toast.success('Account restored');
    },
    onError: (error) => toastApiError(error, 'Failed to restore the account.'),
  });

  const menuItemsFor = (user: PlatformUser): MenuItem[] => {
    const { name } = identityOf(user);
    const items: MenuItem[] = [
      { kind: 'link', label: 'View details', to: `/admin/platform-users/${user.id}`, icon: <UserIcon size={16} /> },
    ];
    if (user.deleted_at) {
      // The window is a hard deadline: past it the account counts as erased,
      // even if the purge hasn't removed it yet (the backend refuses too).
      if (now < restoreDeadline(user.deleted_at)) {
        items.push({ kind: 'button', label: 'Restore account', icon: <RotateCcw size={16} />, onSelect: () => restoreMutation.mutate(user.id) });
      }
      return items;
    }
    if (user.is_active) {
      items.push({
        kind: 'button',
        label: 'Suspend',
        icon: <XCircle size={16} />,
        onSelect: () =>
          setModalConfig({
            title: 'Suspend account',
            message: `${name} will be signed out and won't be able to sign in until you reactivate the account. Their workspaces and posts stay as they are.`,
            confirmText: 'Suspend',
            action: () => statusMutation.mutate({ id: user.id, is_active: false }),
          }),
      });
    } else {
      items.push({ kind: 'button', label: 'Reactivate', icon: <CheckCircle2 size={16} />, onSelect: () => statusMutation.mutate({ id: user.id, is_active: true }) });
    }
    items.push({
      kind: 'button',
      label: 'Delete account',
      icon: <Trash2 size={16} />,
      danger: true,
      onSelect: () =>
        setModalConfig({
          title: 'Delete account',
          message: `${name} will be signed out and lose access immediately.\n\nYou can restore the account from the Deleted tab for ${SOFT_DELETE_RETENTION_DAYS} days. After that it's erased permanently.`,
          confirmText: 'Delete account',
          action: () => deleteMutation.mutate(user.id),
        }),
    });
    return items;
  };

  const sheetUser = menuFor !== null ? users.find((u) => u.id === menuFor) ?? null : null;

  if (isLoading) return <UsersSkeleton />;

  // A failed request must not fall through to "no users found".
  if (isError && !data) {
    return (
      <div className="p-4 sm:p-6 max-w-full sm:max-w-400 mx-auto">
        <LoadError title="Couldn't load users" onRetry={() => refetch()} isRetrying={isFetching} />
      </div>
    );
  }

  const renderMenuItem = (item: MenuItem, variant: 'popover' | 'sheet') => {
    const base =
      variant === 'sheet'
        ? 'flex w-full min-h-12 items-center gap-3 px-5 text-left text-[15px] font-medium active:bg-zinc-100 dark:active:bg-zinc-800'
        : 'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800';
    if (item.kind === 'link') {
      return (
        <Link key={item.label} role="menuitem" to={item.to} onClick={() => setMenuFor(null)} className={`${base} text-zinc-800 dark:text-zinc-200`}>
          <span className="text-zinc-400">{item.icon}</span> {item.label}
        </Link>
      );
    }
    return (
      <button
        key={item.label}
        role="menuitem"
        onClick={() => {
          setMenuFor(null);
          item.onSelect();
        }}
        className={`${base} ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-200'}`}
      >
        <span className={item.danger ? '' : 'text-zinc-400'}>{item.icon}</span> {item.label}
      </button>
    );
  };

  const emptyMessage = q
    ? `No accounts match "${q}"`
    : status === 'deleted'
      ? 'No deleted accounts. Deleted accounts stay here for 30 days before they are erased.'
      : status === 'suspended'
        ? 'No suspended accounts.'
        : 'No accounts here yet.';

  return (
    <div className="p-4 sm:p-6 max-w-full sm:max-w-400 mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Platform users</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {counts ? `${counts.all.toLocaleString()} ${counts.all === 1 ? 'account' : 'accounts'}` : ' '}
          {hasFilters && ' matching your filters'}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={16} />
            {/* text-base on mobile: iOS zooms into inputs under 16px */}
            <input
              type="search"
              aria-label="Search accounts"
              placeholder="Name, username or email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-11 sm:h-10 pl-9 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-base sm:text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <select
            aria-label="Filter by workspace"
            value={workspace}
            onChange={(e) => updateParams({ workspace: e.target.value })}
            className="h-11 sm:h-10 w-full sm:w-60 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base sm:text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All workspaces</option>
            {workspaceOptions.map((w) => (
              <option key={w.blog_id} value={w.blog_id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Same tabs as the moderation queue: a 2x2 grid of chips on mobile so
            every label and count is visible, a segmented control from sm up */}
        <div>
          <div role="tablist" aria-label="Account status" className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-max sm:items-center sm:gap-1 sm:rounded-xl sm:bg-zinc-100 sm:p-1 sm:dark:bg-zinc-800">
            {STATUS_TABS.map((tab) => {
              const selected = tab.key === status;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => updateParams({ status: tab.key })}
                  // bg-white/100, not bg-white: index.css forces `.dark .bg-white` to the
                  // panel colour with !important, which would hide the selected tab.
                  className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-all sm:h-9 sm:justify-start sm:rounded-lg sm:border-0 ${
                    selected
                      ? 'border-zinc-300 bg-white/100 text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white'
                      : 'border-zinc-200 text-zinc-500 hover:text-zinc-700 max-sm:bg-zinc-50 dark:border-zinc-700 dark:hover:text-zinc-300 max-sm:dark:bg-zinc-900/40'
                  }`}
                >
                  {tab.label}
                  {counts && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                        selected ? 'bg-accent text-accent-text' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700'
                      }`}
                    >
                      {counts[tab.key].toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-14 text-center">
          <Users className="mb-3 text-zinc-300 dark:text-zinc-700" size={40} />
          <p className="max-w-sm font-medium text-zinc-600 dark:text-zinc-400">{emptyMessage}</p>
          {hasFilters && (
            <button
              onClick={() => updateParams({ q: '', workspace: '' })}
              className="mt-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline decoration-dotted"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <div className={`hidden md:grid ${GRID_COLS} gap-x-4 rounded-t-xl border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400`}>
            <span>Account</span>
            <span>Workspaces</span>
            <span>{status === 'deleted' ? 'Purge' : 'Last login'}</span>
            <span>Joined</span>
            <span className="sr-only">Actions</span>
          </div>

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => {
              const isSelf = currentUser?.id === user.id;
              const { name, email, username } = identityOf(user);
              const lastSeen = user.last_login ? `Last seen ${formatSmart(user.last_login)}` : 'Never logged in';
              const timing = user.deleted_at ? purgeLabel(user.deleted_at, now) : lastSeen;

              return (
                <li key={user.id} className={`flex items-center pr-1.5 md:grid ${GRID_COLS} md:gap-x-4 md:pr-3 ${user.deleted_at ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                  <Link
                    to={isSelf ? '/admin/profile' : `/admin/platform-users/${user.id}`}
                    className="flex min-w-0 flex-1 items-center py-3 pl-4 md:col-span-4 md:grid md:grid-cols-subgrid md:pl-5 active:bg-zinc-50 md:hover:bg-zinc-50/60 dark:active:bg-zinc-800/40 dark:md:hover:bg-zinc-800/20"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar firstName={user.first_name || username || '?'} lastName={user.last_name || ''} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
                          {isSelf && <Pill className="border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">you</Pill>}
                          {user.is_super_admin && (
                            <Pill className="border-primary/20 bg-accent text-accent-text">
                              <ShieldCheck size={11} /> Super admin
                            </Pill>
                          )}
                          {user.deleted_at ? (
                            <Pill className="border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">Deleted</Pill>
                          ) : (
                            !user.is_active && <Pill className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">Suspended</Pill>
                          )}
                        </div>
                        <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{email}</p>
                        <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 md:hidden">
                          {/* Timing first: workspace names can be long and get truncated */}
                          <span className={user.deleted_at ? 'text-red-600 dark:text-red-400' : ''}>{timing}</span>
                          <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                          {workspaceSummary(user)}
                        </p>
                      </div>
                    </div>

                    <div className="hidden min-w-0 flex-wrap gap-1.5 md:flex" title={user.blog_memberships.map((m) => `${m.blog.name} (${m.role})`).join('\n') || undefined}>
                      {user.blog_memberships.length === 0 && <span className="text-xs text-zinc-400 dark:text-zinc-500">No workspace</span>}
                      {user.blog_memberships.slice(0, 2).map((m) => (
                        <span key={m.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="truncate">{m.blog.name}</span>
                          <span className={`rounded px-1 text-[10px] font-semibold ${ROLE_META[m.role].color}`}>{ROLE_META[m.role].label}</span>
                        </span>
                      ))}
                      {user.blog_memberships.length > 2 && (
                        <span className="rounded-md px-1 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">+{user.blog_memberships.length - 2}</span>
                      )}
                    </div>

                    <div className="hidden text-xs md:block">
                      {user.deleted_at ? (
                        <span className="font-medium text-red-600 dark:text-red-400" title={`Deleted ${formatLocalDateTime(user.deleted_at)}`}>
                          {purgeLabel(user.deleted_at, now)}
                        </span>
                      ) : user.last_login ? (
                        <span className="text-zinc-600 dark:text-zinc-400" title={formatLocalDateTime(user.last_login)}>{formatSmart(user.last_login)}</span>
                      ) : (
                        <span className="italic text-zinc-400 dark:text-zinc-500">Never</span>
                      )}
                    </div>

                    <div className="hidden text-xs text-zinc-500 dark:text-zinc-400 md:block">{formatLocalDate(user.created_at)}</div>
                  </Link>

                  {isSelf ? (
                    <span className="w-11 flex-shrink-0" aria-hidden />
                  ) : (
                    <div className="relative flex-shrink-0 md:justify-self-end" ref={menuFor === user.id ? menuRef : null}>
                      <button
                        onClick={() => setMenuFor(menuFor === user.id ? null : user.id)}
                        aria-label={`Actions for ${name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuFor === user.id}
                        className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {(statusMutation.isPending && statusMutation.variables?.id === user.id) ||
                        (restoreMutation.isPending && restoreMutation.variables === user.id) ? (
                          <Spinner size={14} className="text-zinc-400" />
                        ) : (
                          <MoreHorizontal size={18} />
                        )}
                      </button>
                      {menuFor === user.id && (
                        <div role="menu" className="absolute right-0 top-full z-30 mt-1 hidden w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 md:block">
                          {menuItemsFor(user).map((item) => renderMenuItem(item, 'popover'))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:justify-between">
            <span>
              Showing {users.length.toLocaleString()} of {total.toLocaleString()}
            </span>
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex h-10 sm:h-8 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
              >
                {isFetchingNextPage && <Spinner size={14} />} Load more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile action sheet (the desktop popover lives in the row) */}
      {sheetUser && (
        <div className="fixed inset-0 z-60 flex items-end bg-zinc-950/45 backdrop-blur-sm md:hidden">
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for ${identityOf(sheetUser).name}`}
            className="w-full rounded-t-2xl border-t border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-3 px-5 pt-4 pb-3">
              <Avatar firstName={sheetUser.first_name || identityOf(sheetUser).username || '?'} lastName={sheetUser.last_name || ''} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{identityOf(sheetUser).name}</p>
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{identityOf(sheetUser).email}</p>
              </div>
            </div>
            <div role="menu" className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
              {menuItemsFor(sheetUser).map((item) => renderMenuItem(item, 'sheet'))}
            </div>
            <div className="px-4 pt-2">
              <button
                onClick={() => setMenuFor(null)}
                className="h-12 w-full rounded-xl bg-zinc-100 text-[15px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!modalConfig}
        title={modalConfig?.title ?? ''}
        message={modalConfig?.message ?? ''}
        confirmText={modalConfig?.confirmText}
        isDanger
        onClose={() => setModalConfig(null)}
        onConfirm={() => {
          modalConfig?.action();
          setModalConfig(null);
        }}
      />
    </div>
  );
};
