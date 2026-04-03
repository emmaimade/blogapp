import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const titleSegments = pathSegments.filter(segment => isNaN(Number(segment)));
    if (titleSegments.length === 0) return 'Dashboard';
    const mainSection = titleSegments[0];
    return mainSection.charAt(0).toUpperCase() + mainSection.slice(1);
  };

  const getBreadcrumb = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const titleSegments = pathSegments.filter(segment => isNaN(Number(segment)));
    if (titleSegments.length <= 1) return 'Admin Studio';
    return ['Admin Studio', ...titleSegments.map(s => s.charAt(0).toUpperCase() + s.slice(1))].join(' / ');
  };

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-ink)]">
      <Sidebar />

      <main className="min-h-screen overflow-x-clip lg:pl-72">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-24 sm:px-6 md:px-8 lg:px-8 lg:pt-8 xl:px-10">
          <header className="admin-glass mb-6 overflow-hidden rounded-[2rem] p-4 sm:p-6 xl:mb-8 xl:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{getPageTitle()}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{getBreadcrumb()}</p>
              </div>

              <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-end">
                <div className="admin-card relative flex min-w-0 flex-1 items-center rounded-2xl border border-slate-200 dark:border-slate-700 lg:max-w-md">
                  <Search className="absolute left-4 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search posts, users, or settings..."
                    className="h-11 w-full rounded-2xl bg-transparent pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                  />
                </div>

                <button className="admin-card hidden h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-indigo-600 sm:flex">
                  <Bell size={20} />
                </button>

                {user && (
                  <div className="admin-card flex min-w-0 items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:justify-start">
                    <div className="min-w-0 text-left sm:text-right">
                      <div className="font-semibold text-slate-900 dark:text-white">{user.username}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">{user.role}</div>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
