import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Eye, MessageSquare, MoreHorizontal, Search, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatLocalDateTime } from '../../../shared/utils/dates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchModerationQueue = async () => {
  const res = await axios.get(`${API_URL}/superadmin/moderation`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

type FilterTab = 'pending' | 'approved' | 'rejected' | 'removed';

const MENU_WIDTH = 176; // w-44

const ActionMenu = ({
  item,
  onAction,
}: {
  item: any;
  onAction: (action: 'approve' | 'reject' | 'remove') => void;
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 4,
      left: Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
    });
  };

  const toggle = () => {
    if (!open) updatePosition();
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleReposition = () => updatePosition();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label="Item actions"
        aria-expanded={open}
        className="p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="z-50 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1"
          >
            {item.status === 'pending' ? (
              <>
                <button
                  onClick={() => { onAction('approve'); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  onClick={() => { onAction('reject'); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  <XCircle size={14} /> Reject report
                </button>
                <button
                  onClick={() => { onAction('remove'); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} /> Remove content
                </button>
              </>
            ) : (
              <button
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <CheckCircle2 size={14} /> Reviewed
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export const SuperAdminModerationPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['superadmin-moderation'],
    queryFn: fetchModerationQueue,
  });

  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' | 'remove' }) =>
      axios.post(`${API_URL}/superadmin/moderation/${id}/actions`, { action }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadmin-moderation'] }),
  });

  const bulkModerate = useMutation({
    mutationFn: async (action: 'approve' | 'reject' | 'remove') => {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          axios.post(`${API_URL}/superadmin/moderation/${id}/actions`, { action }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-moderation'] });
      setSelectedIds(new Set());
    },
  });

  const allItems = items ?? [];
  const pendingCount = allItems.filter((item: any) => item.status === 'pending').length;

  const filtered = allItems.filter((item: any) => {
    const matchesSearch =
      item.content?.toLowerCase().includes(search.toLowerCase()) ||
      item.author?.toLowerCase().includes(search.toLowerCase()) ||
      item.blog_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.reason?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    return item.status === tab;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'approved', label: 'Approved', count: allItems.filter((item: any) => item.status === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: allItems.filter((item: any) => item.status === 'rejected').length },
    { key: 'removed', label: 'Removed', count: allItems.filter((item: any) => item.status === 'removed').length },
  ];

  const allSelected = filtered.length > 0 && filtered.every((item: any) => selectedIds.has(item.id));
  const someSelected = filtered.some((item: any) => selectedIds.has(item.id)) && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((item: any) => item.id)));
  };

  return (
      <div className={`p-4 sm:p-8 max-w-full sm:max-w-7xl mx-auto space-y-6 ${selectedIds.size > 0 ? 'pb-24' : ''}`}>
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Moderation</h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400">Review flagged content across all tenant blogs.</p>
      </div>

      {/* Alert banner if flagged comments */}
      {pendingCount > 0 && (
        <div className="flex items-start sm:items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 sm:mt-0" />
          <span className="flex-1">
            <strong>{pendingCount}</strong> item{pendingCount > 1 ? 's' : ''} waiting for review.
          </span>
          <button onClick={() => setTab('pending')} className="shrink-0 text-xs font-bold underline">
            View pending
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* Mobile: 2x2 grid of chips — full labels, all counts visible at once */}
        <div className="grid grid-cols-2 gap-2 w-full sm:hidden">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                tab === key
                  ? 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <span>{label}</span>
              <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-accent text-accent-text' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Desktop: original compact pill row */}
        <div className="hidden sm:flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 w-fit">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-accent text-accent-text' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search comments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Comments list */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-5">
                <div className="h-4 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-48 mb-2" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <MessageSquare size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-500 text-sm">{search ? 'No queue items match your search.' : 'No items in this view.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {tab === 'pending' && (
              <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-zinc-50/60 dark:bg-zinc-900/20">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all pending items"
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary/30"
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </span>
              </div>
            )}
            {filtered.map((item: any) => (
              <div key={item.id} className={`px-4 sm:px-6 py-4 sm:py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${item.status !== 'pending' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {tab === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={`Select item from ${item.author ?? 'unknown author'}`}
                        className="w-4 h-4 mt-1.5 shrink-0 rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary/30"
                      />
                    )}
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {item.author?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate max-w-[10rem] sm:max-w-none">{item.author ?? 'Unknown'}</span>
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-0.5 rounded-full shrink-0">
                            <AlertTriangle size={10} /> Pending
                          </span>
                        )}
                        <span className="text-xs text-zinc-400 shrink-0">{item.item_type}</span>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2 break-words">
                        {item.content}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 break-words">Reason: {item.reason}</p>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span className="flex items-center gap-1 min-w-0 max-w-[12rem]">
                          <Eye size={11} className="shrink-0" /> <span className="truncate">{item.blog_name}</span>
                        </span>
                        <span className="shrink-0">{formatLocalDateTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <ActionMenu
                    item={item}
                    onAction={(action) => moderate.mutate({ id: item.id, action })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto z-40 flex items-center justify-between sm:justify-start gap-3 sm:gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <span className="text-sm font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => bulkModerate.mutate('approve')}
              disabled={bulkModerate.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> <span className="hidden sm:inline">Approve</span>
            </button>
            <button
              onClick={() => bulkModerate.mutate('reject')}
              disabled={bulkModerate.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <XCircle size={14} /> <span className="hidden sm:inline">Reject</span>
            </button>
            <button
              onClick={() => bulkModerate.mutate('remove')}
              disabled={bulkModerate.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} /> <span className="hidden sm:inline">Remove</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};