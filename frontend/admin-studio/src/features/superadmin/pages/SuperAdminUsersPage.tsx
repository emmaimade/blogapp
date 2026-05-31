import { useQuery } from '@tanstack/react-query';
import { Search, Users, Shield, UserCheck, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { useQueryClient, useMutation } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchAllUsers = async () => {
  const res = await axios.get(`${API_URL}/superadmin/users`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

const roleBadge: Record<string, string> = {
  superadmin: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin:      'bg-accent text-accent-text',
  user:       'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
};

export const SuperAdminUsersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['superadmin-users'],
    queryFn: fetchAllUsers,
  });

  const toggleSuspend = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      axios.patch(`${API_URL}/superadmin/users/${id}`, { is_active: active }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadmin-users'] }),
  });

  const filtered = (users ?? []).filter((u: any) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSuperAdmins = (users ?? []).filter((u: any) => u.is_super_admin).length;
  const totalRegular = (users ?? []).length - totalSuperAdmins;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Users</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Manage all platform users across all tenants.</p>
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total users', value: (users ?? []).length, icon: Users, color: 'text-primary', bg: 'bg-accent' },
          { label: 'Super admins', value: totalSuperAdmins, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Regular users', value: totalRegular, icon: UserCheck, color: 'text-zinc-600', bg: 'bg-zinc-100' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={15} className={color} />
            </div>
            <div>
              <div className="text-lg font-black text-zinc-900 dark:text-white leading-none">{value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by name or email…"
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
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">User</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Role</th>
                <th className="text-right px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Workspaces</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Joined</th>
                <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-28" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user: any) => {
                  const isActive = user.is_active !== false;
                  const role = user.is_super_admin ? 'superadmin' : (user.platform_role ?? 'user');
                  const initials = user.username?.slice(0, 2).toUpperCase() ?? '??';
                  const joined = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
                  const workspaces = user.blog_memberships?.length ?? 0;

                  return (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-white">{user.username}</p>
                            <p className="text-xs text-zinc-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadge[role] ?? roleBadge.user}`}>
                          {user.is_super_admin}
                          {role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-900 dark:text-white">{workspaces}</td>
                      <td className="px-6 py-4 text-xs text-zinc-500">{joined}</td>
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-2.5 py-0.5 rounded-full">
                            <XCircle size={11} /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-700"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenu === user.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1">
                              <button
                                onClick={() => { toggleSuspend.mutate({ id: user.id, active: !isActive }); setOpenMenu(null); }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
                              >
                                {isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                {isActive ? 'Suspend' : 'Reactivate'}
                              </button>
                            </div>
                          )}
                        </div>
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
