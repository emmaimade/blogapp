import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export const StatCard = ({
  title, value, sub, icon, accent = false,
}: {
  title: string; value: number; sub: string;
  icon: React.ReactNode; accent?: boolean;
}) => (
  <div className={`admin-card flex flex-col gap-4 p-5 ${accent ? 'ring-1 ring-violet-200 dark:ring-violet-800/50' : ''}`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
        {icon}
      </div>
    </div>
    <div>
      <div className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{sub}</div>
    </div>
  </div>
);

export const PublishProgress = ({ 
  published, scheduled, total 
}: { 
  published: number; scheduled: number; total: number; 
}) => {
  const pct = total > 0 ? Math.round((published / total) * 100) : 0;
  return (
    <div className="admin-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Publishing rate</span>
        <span className="text-sm font-bold text-zinc-900 dark:text-white">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{published} published</span>
        <span>{scheduled} scheduled</span>
        <span>{total - published - scheduled} drafts</span>
      </div>
    </div>
  );
};

export const QuickAction = ({
  to, icon, label, desc, primary = false,
}: {
  to: string; icon: React.ReactNode; label: string; desc: string; primary?: boolean;
}) => (
  <Link
    to={to}
    className={`group flex items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
      primary
        ? 'border-violet-200 bg-violet-50 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-950/30 dark:hover:border-violet-700'
        : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700'
    }`}
  >
    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
      primary ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
    }`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className={`font-semibold ${primary ? 'text-violet-800 dark:text-violet-300' : 'text-zinc-900 dark:text-white'}`}>{label}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</div>
    </div>
    <ArrowUpRight size={16} className="flex-shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-zinc-600" />
  </Link>
);

export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="h-8 w-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-40 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
      </div>
      <div className="flex items-center gap-2 mt-4 sm:mt-0">
        <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="admin-card flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-8 w-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div>
            <div className="h-8 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-32 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
          </div>
        </div>
      ))}
    </div>
  </div>
);