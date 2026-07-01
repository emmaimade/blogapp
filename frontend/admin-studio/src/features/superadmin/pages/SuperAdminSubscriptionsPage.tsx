import { useQuery } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, Clock, XCircle, Search, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatLocalDate, formatLocalDateTime, formatSmart } from '../../../shared/utils/dates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchSubscriptions = async () => {
  const res = await axios.get(`${API_URL}/superadmin/subscriptions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

const planColors: Record<string, string> = {
  FREE:         'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  STARTER:      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PROFESSIONAL: 'bg-accent text-accent-text',
  ENTERPRISE:   'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  active:   { color: 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400', icon: <CheckCircle2 size={11} /> },
  trialing: { color: 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400', icon: <Clock size={11} /> },
  expired:  { color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400', icon: <XCircle size={11} /> },
  canceled: { color: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-700 dark:text-zinc-400', icon: <XCircle size={11} /> },
};

export const SuperAdminSubscriptionsPage = () => {
  const [search, setSearch] = useState('');

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['superadmin-subscriptions'],
    queryFn: fetchSubscriptions,
  });

  const filtered = (subscriptions ?? []).filter((s: any) =>
    s.blog_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.plan?.toLowerCase().includes(search.toLowerCase())
  );

  // Summary counts
  const planCounts = (subscriptions ?? []).reduce((acc: Record<string, number>, s: any) => {
    acc[s.plan] = (acc[s.plan] ?? 0) + 1;
    return acc;
  }, {});

  const trialCount = (subscriptions ?? []).filter((s: any) => s.status === 'trialing').length;
  const expiredCount = (subscriptions ?? []).filter((s: any) => s.status === 'expired' || s.status === 'canceled').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Subscriptions</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Monitor plan distribution and subscription status across all tenants.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(planCounts).map(([plan, count]) => (
          <div key={plan} className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${planColors[plan] ?? planColors.FREE}`}>
              {plan}
            </div>
            <div className="text-3xl font-black text-zinc-900 dark:text-white">{String(count)}</div>
            <div className="text-xs text-zinc-500 mt-1">workspaces</div>
          </div>
        ))}
        {Object.keys(planCounts).length === 0 && !isLoading && (
          <div className="col-span-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5 text-center text-zinc-500 text-sm">
            No subscription data yet.
          </div>
        )}
      </div>

      {/* Trial & Expiry alerts */}
      {(trialCount > 0 || expiredCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {trialCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
              <Clock size={15} />
              <span><strong>{trialCount}</strong> workspace{trialCount > 1 ? 's' : ''} on trial</span>
            </div>
          )}
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <XCircle size={15} />
              <span><strong>{expiredCount}</strong> expired or canceled</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by blog name or plan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Blog</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Plan</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Trial ends</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Period ends</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    {search ? 'No results match your search.' : 'No subscriptions found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((sub: any) => {
                  const status = sub.status ?? 'active';
                  const sc = statusConfig[status] ?? statusConfig.active;
                  return (
                    <tr key={sub.blog_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                            <CreditCard size={13} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-white">{sub.blog_name ?? `Blog #${sub.blog_id}`}</p>
                            <p className="text-xs text-zinc-500">ID: {sub.blog_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${planColors[sub.plan] ?? planColors.FREE}`}>
                          {sub.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          {sc.icon} {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {formatLocalDate(sub.trial_ends_at)}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {formatLocalDate(sub.current_period_ends_at)}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/blogs`}
                          className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
                        >
                          View <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};