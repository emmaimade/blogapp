import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MoreHorizontal, CheckCircle2, XCircle, Trash2, Layers, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/context/AuthContext';
import { formatLocalDate, formatLocalDateTime, formatSmart } from '../../../shared/utils/dates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const SuperAdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  
  // Track composite unique keys (`${workspaceName}-${userId}`) instead of just user.id
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  
  // Track EXPANDED workspaces instead of collapsed ones on page initialization
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<{ [key: string]: boolean }>({
    "Global System Administrators": true,
  });
  
  const activeMenuRef = useRef<HTMLDivElement | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['superadmin-users'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/superadmin/users?include_deleted=true`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      axios.delete(`${API_URL}/superadmin/users/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
      toast.success('User account permanently deleted');
      setOpenMenuKey(null);
    },
    onError: () => {
      toast.error('Failed to delete user account');
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      axios.patch(
        `${API_URL}/superadmin/users/${id}`,
        { is_active },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
      toast.success(variables.is_active ? 'User reactivated successfully' : 'User suspended successfully');
      setOpenMenuKey(null);
    },
    onError: () => {
      toast.error('Failed to update suspension status');
    },
  });

  // Close context dropdown menus when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuRef.current && !activeMenuRef.current.contains(event.target as Node)) {
        setOpenMenuKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleWorkspaceCollapse = (workspaceName: string) => {
    setExpandedWorkspaces((prev) => ({
      ...prev,
      [workspaceName]: !prev[workspaceName],
    }));
  };

  const handleToggleSuspend = (e: React.MouseEvent, targetUser: any) => {
    e.stopPropagation();
    toggleSuspendMutation.mutate({ id: targetUser.id, is_active: !targetUser.is_active });
  };

  const handleDelete = (e: React.MouseEvent, targetUser: any) => {
    e.stopPropagation();
    if (window.confirm(`Are you absolutely sure you want to permanently delete ${targetUser.username}? This action cannot be undone.`)) {
      deleteMutation.mutate(targetUser.id);
    }
  };

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const term = search.toLowerCase();
    return users.filter(
      (u: any) =>
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.first_name && u.first_name.toLowerCase().includes(term)) ||
        (u.last_name && u.last_name.toLowerCase().includes(term))
    );
  }, [users, search]);

  // Isolate SuperAdmins cleanly and group regular users by workspace tenant with their context roles
  const groupedByWorkspace = useMemo(() => {
    const groups: { [key: string]: any[] } = {};

    filteredUsers.forEach((user: any) => {
      if (user.is_super_admin || user.platform_role === 'superadmin') {
        const adminGroupName = "Global System Administrators";
        if (!groups[adminGroupName]) groups[adminGroupName] = [];
        groups[adminGroupName].push({ ...user, contextualRole: 'Super Admin' });
        return;
      }

      if (user.blog_memberships && user.blog_memberships.length > 0) {
        user.blog_memberships.forEach((membership: any) => {
          const workspaceName = membership.blog?.name || "Unknown Workspace";
          if (!groups[workspaceName]) groups[workspaceName] = [];
          if (!groups[workspaceName].some((u) => u.id === user.id)) {
            groups[workspaceName].push({
              ...user,
              contextualRole: membership.role
            });
          }
        });
      } else {
        const orphanGroupName = "No Assigned Workspace";
        if (!groups[orphanGroupName]) groups[orphanGroupName] = [];
        groups[orphanGroupName].push({ ...user, contextualRole: 'Unassigned' });
      }
    });

    return groups;
  }, [filteredUsers]);

  // Sort groups to push Administration and Orphan buckets to the top
  const sortedWorkspaceEntries = useMemo(() => {
    return Object.entries(groupedByWorkspace).sort(([nameA], [nameB]) => {
      if (nameA === "Global System Administrators") return -1;
      if (nameB === "Global System Administrators") return 1;
      if (nameA === "No Assigned Workspace") return -1;
      if (nameB === "No Assigned Workspace") return 1;
      return nameA.localeCompare(nameB);
    });
  }, [groupedByWorkspace]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
        <div className="h-64 bg-zinc-50 dark:bg-zinc-900/50 animate-pulse rounded-xl border border-zinc-100 dark:border-zinc-800" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header View */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          User Management
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Monitor infrastructure permissions, manage security multi-tenancy, and handle suspension states.
        </p>
      </div>

      {/* Control Actions & Searching */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/20 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/50">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search users by name or email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
          />
        </div>
        <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 self-start sm:self-auto">
          Showing {filteredUsers.length} total user records
        </div>
      </div>

      {/* Empty State Trigger Screen */}
      {sortedWorkspaceEntries.length === 0 && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No platform users found matching the search query criteria.
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* INDUSTRY STANDARD MOBILE CARD VIEW CONTAINER (Hidden on Desktop) */}
      {/* ------------------------------------------------------------- */}
      <div className="block md:hidden space-y-4">
        {sortedWorkspaceEntries.map(([workspaceName, tenantUsers]) => {
          const isExpanded = !!expandedWorkspaces[workspaceName];

          return (
            <div key={`mobile-group-${workspaceName}`} className="space-y-2">
              {/* Workspace Mobile Accordion Title Line */}
              <div
                onClick={() => toggleWorkspaceCollapse(workspaceName)}
                className="flex items-center justify-between p-3 bg-zinc-50/80 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl cursor-pointer select-none text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers size={13} className="text-zinc-400 flex-shrink-0" />
                  <span className="truncate">{workspaceName}</span>
                  <span className="text-zinc-400 dark:text-zinc-500 font-normal flex-shrink-0">({tenantUsers.length})</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? '' : '-rotate-90'}`}
                />
              </div>

              {/* Stacked Cards Layout */}
              {isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tenantUsers.map((accountRow: any) => {
                    const isSelf = currentUser?.id === accountRow.id;
                    const isDeleted = !!accountRow.deleted_at;
                    const currentUniqueRowKey = `${workspaceName}-${accountRow.id}`;
                    const targetMobileKey = `mobile-${currentUniqueRowKey}`;

                    const firstInitial = accountRow.first_name ? accountRow.first_name.slice(0, 1) : '';
                    const lastInitial = accountRow.last_name ? accountRow.last_name.slice(0, 1) : (accountRow.username ? accountRow.username.slice(0, 1) : '?');

                    return (
                      <div
                        key={`card-${currentUniqueRowKey}`}
                        className={`p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-xs space-y-3 relative ${
                          isDeleted ? "border-red-200/60 bg-red-50/5 dark:border-red-900/30" : "border-zinc-200/70 dark:border-zinc-800"
                        }`}
                      >
                        {/* Profile Header Block inside Mobile Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-semibold text-xs text-zinc-600 dark:text-zinc-300 uppercase flex-shrink-0">
                              {firstInitial || lastInitial ? `${firstInitial}${lastInitial}` : "U"}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-xs text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5 truncate">
                                {accountRow.first_name || accountRow.last_name
                                  ? `${accountRow.first_name || ""} ${accountRow.last_name || ""}`.trim()
                                  : accountRow.username}
                                {isSelf && (
                                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 border border-zinc-200/50">
                                    you
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">@{accountRow.username}</span>
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate text-wrap break-all">{accountRow.email}</span>
                            </div>
                          </div>

                          {/* Dropdown Action Portal for Mobile Card */}
                          <div className="relative" ref={openMenuKey === targetMobileKey ? activeMenuRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setOpenMenuKey(openMenuKey === targetMobileKey ? null : targetMobileKey);
                              }}
                              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors relative z-10"
                            >
                              <MoreHorizontal size={15} />
                            </button>

                            {openMenuKey === targetMobileKey && (
                              <div 
                                className="absolute right-0 mt-1 w-44 origin-top-right z-50 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1 text-xs text-left animate-in fade-in slide-in-from-top-1 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link
                                  to={isSelf ? "/admin/profile" : `/admin/users/${accountRow.id}`}
                                  onClick={() => setOpenMenuKey(null)}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 font-medium text-zinc-700 dark:text-zinc-100"
                                >
                                  <Layers size={13} className="text-zinc-400" />
                                  {isSelf ? "View My Profile" : "View Detailed Info"}
                                </Link>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSuspend(e, accountRow);
                                  }}
                                  disabled={isSelf || isDeleted}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 disabled:opacity-50 text-left"
                                >
                                  {accountRow.is_active ? <XCircle size={13} className="text-zinc-400" /> : <CheckCircle2 size={13} className="text-zinc-400" />}
                                  {accountRow.is_active ? "Suspend" : "Reactivate"}
                                </button>
                                <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(e, accountRow);
                                  }}
                                  disabled={isSelf}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 font-medium text-left"
                                >
                                  <Trash2 size={13} /> Delete Account
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

                        {/* Split Metadata Responsive Blocks Grid */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-[11px] leading-tight">
                          <div>
                            <span className="text-zinc-400 block mb-0.5 uppercase tracking-wide text-[9px]">Workspace Role</span>
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border capitalize ${
                                accountRow.contextualRole === "Super Admin" || accountRow.contextualRole === "owner"
                                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/50"
                                  : accountRow.contextualRole === "editor"
                                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/50"
                                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
                              }`}
                            >
                              {accountRow.contextualRole}
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-400 block mb-0.5 uppercase tracking-wide text-[9px]">Account Status</span>
                            {isDeleted ? (
                              <span className="text-red-600 dark:text-red-400 font-medium">Soft Deleted</span>
                            ) : accountRow.is_active ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">Suspended</span>
                            )}
                          </div>

                          <div>
                            <span className="text-zinc-400 block mb-0.5 uppercase tracking-wide text-[9px]">Last Login</span>
                            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                              {accountRow.last_login ? formatSmart(accountRow.last_login) : <span className="text-zinc-400 italic font-normal">Never</span>}
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-400 block mb-0.5 uppercase tracking-wide text-[9px]">Registration Date</span>
                            <span className="text-zinc-500 dark:text-zinc-400 font-medium">{formatLocalDate(accountRow.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* STANDARD DESKTOP DATA GRID VIEW (Hidden on Mobile view)       */}
      {/* ------------------------------------------------------------- */}
      {sortedWorkspaceEntries.length > 0 && (
        <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3">User Profile</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Last Login</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date Registered</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {sortedWorkspaceEntries.map(([workspaceName, tenantUsers]) => {
                  const isExpanded = !!expandedWorkspaces[workspaceName];

                  return (
                    <Fragment key={`desktop-${workspaceName}`}>
                      {/* Visual Tenant Group Splitter Header Row */}
                      <tr 
                        onClick={() => toggleWorkspaceCollapse(workspaceName)}
                        className="bg-zinc-50/40 dark:bg-zinc-800/20 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer select-none transition-colors border-y border-zinc-100 dark:border-zinc-800/60"
                      >
                        <td colSpan={6} className="px-6 py-3 font-medium text-zinc-700 dark:text-zinc-300 text-xs">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Layers size={13} className="text-zinc-400 dark:text-zinc-500" />
                              <span>{workspaceName}</span>
                              <span className="text-zinc-400 dark:text-zinc-500 font-normal">({tenantUsers.length} members)</span>
                            </div>
                            <ChevronDown 
                              size={14} 
                              className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${
                                !isExpanded ? '-rotate-90' : ''
                              }`} 
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Render related profile rows only if expanded */}
                      {isExpanded && tenantUsers.map((accountRow: any) => {
                        const isSelf = currentUser?.id === accountRow.id;
                        const isDeleted = !!accountRow.deleted_at;
                        const currentUniqueRowKey = `${workspaceName}-${accountRow.id}`;

                        const firstInitial = accountRow.first_name ? accountRow.first_name.slice(0, 1) : '';
                        const lastInitial = accountRow.last_name ? accountRow.last_name.slice(0, 1) : (accountRow.username ? accountRow.username.slice(0, 1) : '?');

                        return (
                          <tr
                            key={`row-${currentUniqueRowKey}`}
                            className={`group border-b border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors ${
                              isDeleted ? "bg-red-50/10 dark:bg-red-950/5" : ""
                            }`}
                          >
                            {/* 1. User Profile */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-medium text-zinc-600 dark:text-zinc-300 uppercase shadow-sm flex-shrink-0">
                                  {firstInitial || lastInitial ? `${firstInitial}${lastInitial}` : "U"}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                                    {accountRow.first_name || accountRow.last_name
                                      ? `${accountRow.first_name || ""} ${accountRow.last_name || ""}`.trim()
                                      : accountRow.username}
                                    {isSelf && (
                                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
                                        you
                                      </span>
                                    )}
                                  </span>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    @{accountRow.username}{" "}
                                    <span className="text-zinc-300 dark:text-zinc-700 mx-1">•</span>{" "}
                                    {accountRow.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. System Context */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border shadow-2xs capitalize ${
                                  accountRow.contextualRole === "Super Admin" || accountRow.contextualRole === "owner"
                                    ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/50"
                                    : accountRow.contextualRole === "editor"
                                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-purple-800/50"
                                      : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
                                }`}
                              >
                                {accountRow.contextualRole}
                              </span>
                            </td>

                            {/* 3. Last Login */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                              {accountRow.last_login ? (
                                <span
                                  title={formatLocalDateTime(accountRow.last_login)}
                                  className="cursor-help border-b border-dotted border-zinc-300 dark:border-zinc-700 pb-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formatSmart(accountRow.last_login)}
                                </span>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-600 italic">Never logged in</span>
                              )}
                            </td>

                            {/* 4. Status */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isDeleted ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400 border border-red-200/40 dark:border-red-900/30">
                                  Soft Deleted
                                </span>
                              ) : accountRow.is_active ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/30">
                                  Suspended
                                </span>
                              )}
                            </td>

                            {/* 5. Date Registered */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">
                              {formatLocalDate(accountRow.created_at)}
                            </td>

                            {/* 6. Actions Dropdown Panel */}
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div
                                className="relative inline-block text-left"
                                ref={openMenuKey === currentUniqueRowKey ? activeMenuRef : null}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuKey(openMenuKey === currentUniqueRowKey ? null : currentUniqueRowKey);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                  <MoreHorizontal size={16} />
                                </button>

                                {openMenuKey === currentUniqueRowKey && (
                                  <div className="absolute right-0 mt-1 w-48 origin-top-right z-50 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1 text-sm text-left animate-in fade-in slide-in-from-top-1 duration-100">
                                    <Link
                                      to={isSelf ? "/admin/profile" : `/admin/users/${accountRow.id}`}
                                      onClick={() => setOpenMenuKey(null)}
                                      className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 font-medium text-zinc-700 dark:text-zinc-100"
                                    >
                                      <Layers size={14} className="text-zinc-400" />{' '}
                                      {isSelf ? "View My Profile" : "View Detailed Info"}
                                    </Link>
                                    <button
                                      onClick={(e) => handleToggleSuspend(e, accountRow)}
                                      disabled={isSelf || isDeleted}
                                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 disabled:opacity-50 text-left"
                                    >
                                      {accountRow.is_active ? <XCircle size={14} className="text-zinc-400" /> : <CheckCircle2 size={14} className="text-zinc-400" />}
                                      {accountRow.is_active ? "Suspend" : "Reactivate"}
                                    </button>

                                    <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />

                                    <button
                                      onClick={(e) => handleDelete(e, accountRow)}
                                      disabled={isSelf}
                                      className="flex w-full items-center gap-2 px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 font-medium text-left"
                                    >
                                      <Trash2 size={14} /> Delete Account
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};