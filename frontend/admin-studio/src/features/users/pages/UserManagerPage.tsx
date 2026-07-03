import { Link } from "react-router-dom";
import { UserPlus, Search, Shield, Trash2, Users, Loader2, AlertTriangle } from "lucide-react";
import { formatSmart, formatLocalDate } from "../../../shared/utils/dates";
import { useUserManager } from "../hooks/useUserManager";
import { InviteModal } from "../components/InviteModal";
import { Avatar, RoleBadge, RoleDropdown } from "../components/UserComponents";

export const UserManager = () => {
  const {
    currentUser, activeBlog, queryClient, searchTerm, setSearchTerm,
    showInviteModal, setShowInviteModal, removingId, setRemovingId,
    filteredMembers, isOwner, isLoading, updateRoleMutation, removeMutation
  } = useUserManager();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={28} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Banner Bar Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {activeBlog?.name ?? "Workspace"} Team
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your workspace member configuration roles, view activity logs, and issue invitation links.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={15} />
            <input
              type="text"
              placeholder="Search members by identity..."
              className="w-full sm:w-56 pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 shadow-xs transition-all active:scale-98"
            >
              <UserPlus size={15} />
              <span>Invite member</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State Fallback Screen */}
      {(filteredMembers?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-16">
          <Users className="mb-3 text-zinc-300 dark:text-zinc-700" size={40} />
          {searchTerm ? (
            <>
              <p className="font-semibold text-zinc-600 dark:text-zinc-400">No members match "{searchTerm}"</p>
              <button onClick={() => setSearchTerm("")} className="mt-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline decoration-dotted">
                Clear active filter search
              </button>
            </>
          ) : (
            <p className="font-semibold text-zinc-600 dark:text-zinc-400">No members added to this team workspace.</p>
          )}
        </div>
      )}

      {/* Primary Context Lists Matrix Wrapper */}
      {(filteredMembers?.length ?? 0) > 0 && (
        <>
          {/* 1. Mobile Layout List Display */}
          <div className="block md:hidden space-y-3">
            {filteredMembers?.map((member) => {
              const isCurrentUser = member.user_id === currentUser?.id;
              const canRemove = isOwner && !isCurrentUser && member.role !== "owner";
              const isConfirmingRemove = removingId === member.id;

              return (
                <div
                  key={member.id}
                  className={`p-4 border rounded-xl bg-white dark:bg-zinc-900 transition-all space-y-3 shadow-xs ${isConfirmingRemove ? "border-red-200 dark:border-red-900/60 bg-red-50/5 dark:bg-red-950/5" : "border-zinc-200 dark:border-zinc-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar firstName={member.user.first_name} lastName={member.user.last_name} size="md" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                          {member.user.first_name} {member.user.last_name}
                          {isCurrentUser && <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">you</span>}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{member.user.username}</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{member.user.email}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isOwner ? (
                        <RoleDropdown member={member} currentUserId={currentUser?.id} onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, newRole: role })} isPending={updateRoleMutation.isPending} />
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                    <div className="text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-400 block">Last Activity Context:</span>
                      {member.user.last_login ? <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatSmart(member.user.last_login)}</span> : <span className="text-zinc-400 dark:text-zinc-600 italic">Never logged in</span>}
                    </div>
                    <div className="flex-shrink-0">
                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-lg p-1">
                          <button onClick={() => removeMutation.mutate(member.id)} disabled={removeMutation.isPending} className="rounded bg-red-600 px-2 py-1 text-2xs font-bold text-white hover:bg-red-700">Remove</button>
                          <button onClick={() => setRemovingId(null)} className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-2xs font-medium text-zinc-700 dark:text-zinc-300">Cancel</button>
                        </div>
                      ) : canRemove ? (
                        <button onClick={() => setRemovingId(member.id)} className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors inline-flex items-center gap-1 font-medium">
                          <Trash2 size={14} /> <span>Remove</span>
                        </button>
                      ) : (
                        <div className="p-2 text-zinc-300 dark:text-zinc-700 cursor-not-allowed" title="Actions Protected"><Shield size={14} /></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Structured Desktop Table Grid View */}
          <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
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
                  {filteredMembers?.map((member) => {
                    const isCurrentUser = member.user_id === currentUser?.id;
                    const canRemove = isOwner && !isCurrentUser && member.role !== "owner";
                    const isConfirmingRemove = removingId === member.id;

                    return (
                      <tr key={member.id} className={`group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors ${isConfirmingRemove ? "bg-red-50/10 dark:bg-red-950/5" : ""}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar firstName={member.user.first_name} lastName={member.user.last_name} />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link to={`/admin/users/${member.user.id}`} className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline hover:text-zinc-600 dark:hover:text-zinc-300 block truncate">
                                  {member.user.first_name} {member.user.last_name}
                                </Link>
                                {isCurrentUser && <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 tracking-wider select-none">you</span>}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">@{member.user.username} <span className="text-zinc-300 dark:text-zinc-700 mx-1">•</span> {member.user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isOwner ? (
                            <RoleDropdown member={member} currentUserId={currentUser?.id} onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, newRole: role })} isPending={updateRoleMutation.isPending} />
                          ) : (
                            <RoleBadge role={member.role} />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                          {member.user.last_login ? (
                            <span title={member.user.last_login} className="cursor-help border-b border-dotted border-zinc-300 dark:border-zinc-700 pb-0.5">{formatSmart(member.user.last_login)}</span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600 italic">Never logged in</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30">Active</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">{formatLocalDate(member.user.created_at)}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {isConfirmingRemove ? (
                            <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg p-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                              <AlertTriangle size={13} className="text-red-600 flex-shrink-0" />
                              <div className="flex gap-1">
                                <button onClick={() => removeMutation.mutate(member.id)} disabled={removeMutation.isPending} className="rounded bg-red-600 px-2 py-0.5 text-2xs font-medium text-white hover:bg-red-700">Confirm</button>
                                <button onClick={() => setRemovingId(null)} className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-0.5 text-2xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100">Cancel</button>
                              </div>
                            </div>
                          ) : canRemove ? (
                            <button onClick={() => setRemovingId(member.id)} className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors inline-flex items-center justify-center" title="Remove from Workspace">
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <div className="p-1.5 inline-flex items-center justify-center text-zinc-300 dark:text-zinc-700 select-none cursor-not-allowed" title={isCurrentUser ? "You cannot modify your own profile actions here." : "Only workspace owners can remove members."}>
                              <Shield size={15} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <InviteModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["blogMembers", activeBlog?.id] })} />
    </div>
  );
};