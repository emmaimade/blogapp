import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Eye, MessageSquare, MoreHorizontal, Search, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { formatLocalDateTime } from '../../../shared/utils/dates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchModerationQueue = async () => {
  const res = await axios.get(`${API_URL}/superadmin/moderation`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

type FilterTab = 'pending' | 'approved' | 'rejected' | 'removed';

export const SuperAdminModerationPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('pending');
  const [openMenu, setOpenMenu] = useState<number | null>(null);

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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Moderation</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Review flagged content across all tenant blogs.</p>
      </div>

      {/* Alert banner if flagged comments */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertTriangle size={16} />
          <span><strong>{pendingCount}</strong> item{pendingCount > 1 ? 's' : ''} waiting for review.</span>
          <button onClick={() => setTab('pending')} className="ml-auto text-xs font-bold underline">
            View pending
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
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

        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search comments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
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
            {filtered.map((item: any) => (
              <div key={item.id} className={`px-6 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${item.status !== 'pending' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                      {item.author?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-white">{item.author ?? 'Unknown'}</span>
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> Pending
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">{item.item_type}</span>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                        {item.content}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Reason: {item.reason}</p>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Eye size={11} /> {item.blog_name}
                        </span>
                        <span>{formatLocalDateTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openMenu === item.id && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1">
                        {item.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => { moderate.mutate({ id: item.id, action: 'approve' }); setOpenMenu(null); }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              onClick={() => { moderate.mutate({ id: item.id, action: 'reject' }); setOpenMenu(null); }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <XCircle size={14} /> Reject report
                            </button>
                            <button
                              onClick={() => { moderate.mutate({ id: item.id, action: 'remove' }); setOpenMenu(null); }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={14} /> Remove content
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setOpenMenu(null)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <CheckCircle2 size={14} /> Reviewed
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};