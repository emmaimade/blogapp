import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Search,
  UserPlus,
  ShieldAlert,
  Calendar,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { Modal } from '../components/Modal';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export const UserManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    user: User;
    newRole: 'admin' | 'user';
  } | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: async () => (await api.get('/users/me')).data
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['adminUsers'],
    queryFn: async () => (await api.get('/admin/users')).data
  });

  const toggleRoleMutation = useMutation({
    mutationFn: ({ id, newRole }: { id: number; newRole: string }) =>
      api.patch(`/admin/${id}/role`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setConfirmAction(null);
      toast.success('Permissions updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update role';
      toast.error(message);
    }
  });

  const handleRoleToggle = (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setConfirmAction({ user, newRole });
  };

  const confirmRoleChange = () => {
    if (!confirmAction) return;

    toggleRoleMutation.mutate({
      id: confirmAction.user.id,
      newRole: confirmAction.newRole
    });
  };

  const filteredUsers = users?.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading user directory...</div>
      </div>
    );
  }

  const getConfirmationMessage = () => {
    if (!confirmAction) return '';

    const { user, newRole } = confirmAction;

    if (newRole === 'admin') {
      return `Promote ${user.username} to admin and grant access to publishing, moderation, settings, and user management?`;
    }

    return `Demote ${user.username} to a standard user account and remove access to the admin dashboard, content tools, and system settings?`;
  };

  return (
    <div className="admin-page">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="admin-kicker">Access control</div>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
            <Users className="text-indigo-600 dark:text-indigo-400" size={30} /> User Directory
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Manage user permissions and community status. ({users?.length || 0} users)
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search username or email..."
            className="w-full rounded-[1.2rem] bg-[var(--admin-primary-soft)] px-10 py-2.5 text-sm font-semibold placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-slate-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {filteredUsers?.map((user) => (
          <article key={user.id} className="admin-card space-y-4 rounded-[1.7rem] p-5">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'
              }`}>
                {user.role === 'admin' ? <ShieldCheck size={20} /> : <UserIcon size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 dark:text-white">{user.username}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Mail size={14} className="shrink-0 text-slate-400" />
                  <span className="break-all">{user.email}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  <Calendar size={10} />
                  Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`admin-badge ${
                user.role === 'admin'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'
              }`}>
                {user.role === 'admin' ? 'Admin' : 'User'}
              </span>

              {user.id === currentUser?.id && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium italic text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <Lock size={12} /> You
                </span>
              )}
            </div>

            {user.id !== currentUser?.id ? (
              <button
                type="button"
                onClick={() => handleRoleToggle(user)}
                disabled={toggleRoleMutation.isPending}
                aria-label={
                  user.role === 'admin'
                    ? `Demote ${user.username} to user`
                    : `Promote ${user.username} to admin`
                }
                className={`admin-btn inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  user.role === 'admin'
                    ? 'admin-btn-danger focus-visible:ring-red-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900'
                    : 'admin-btn-primary focus-visible:ring-indigo-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900'
                }`}
              >
                {user.role === 'admin' ? (
                  <><ShieldAlert size={16} /> Demote to User</>
                ) : (
                  <><UserPlus size={16} /> Promote to Admin</>
                )}
              </button>
            ) : (
              <div className="rounded-2xl bg-[var(--admin-primary-soft)] px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                You (Cannot modify self).
              </div>
            )}
          </article>
        ))}

        {filteredUsers?.length === 0 && (
          <div className="p-12 text-center">
            <Users className="mx-auto mb-4 text-slate-300" size={48} />
            <p className="font-medium text-slate-500">
              {searchTerm
                ? `No users found matching "${searchTerm}"`
                : 'No users in the system yet'
              }
            </p>
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <div className="admin-card admin-table-shell admin-scrollbar">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="admin-table-head">
                  <th className="p-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Member</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Contact</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Status</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(126,92,54,0.08)]">
                {filteredUsers?.map((user) => (
                  <tr key={user.id} className="admin-table-row transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="p-4 dark:text-slate-200">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'
                        }`}>
                          {user.role === 'admin' ? <ShieldCheck size={20} /> : <UserIcon size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{user.username}</div>
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                            <Calendar size={10} />
                            Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        {user.email}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className={`admin-badge ${
                        user.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : ' bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      {user.id !== currentUser?.id ? (
                        <button
                          type="button"
                          onClick={() => handleRoleToggle(user)}
                          disabled={toggleRoleMutation.isPending}
                          aria-label={
                            user.role === 'admin'
                              ? `Demote ${user.username} to user`
                              : `Promote ${user.username} to admin`
                          }
                          className={`admin-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                            user.role === 'admin'
                              ? 'admin-btn-danger focus-visible:ring-red-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900'
                              : 'admin-btn-primary focus-visible:ring-indigo-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <><ShieldAlert size={16} /> Demote to User</>
                          ) : (
                            <><UserPlus size={16} /> Promote to Admin</>
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium italic text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <Lock size={12} /> You (Cannot modify self)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers?.length === 0 && (
            <div className="p-20 text-center">
              <Users className="mx-auto mb-4 text-slate-300" size={48} />
              <p className="font-medium text-slate-500">
                {searchTerm
                  ? `No users found matching "${searchTerm}"`
                  : 'No users in the system yet'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmRoleChange}
        title={confirmAction?.newRole === 'admin' ? 'Promote to Admin?' : 'Demote to User?'}
        message={getConfirmationMessage()}
        confirmText={confirmAction?.newRole === 'admin' ? 'Yes, Make Admin' : 'Yes, Demote to User'}
        isDanger={confirmAction?.newRole !== 'admin'}
      />
    </div>
  );
};
