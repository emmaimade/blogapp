import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Search, Users, Mail, Clock } from "lucide-react";
import { formatSmart, formatLocalDate } from "../../../shared/utils/dates";
import { useUserManager } from "../hooks/useUserManager";
import { InviteModal } from "../components/InviteModal";
import { Avatar, RoleBadge, RoleDropdown, MemberActionsMenu } from "../components/UserComponents";
import { Modal } from "../../../shared/components/Modal";
import { SkeletonBar, SkeletonListRow, TableRowSkeleton } from "../../../shared/ui/Skeleton";
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const UserManagerSkeleton = () => (
  <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-48" />
        <SkeletonBar className="h-4 w-72" />
      </div>
      <SkeletonBar className="h-10 w-full sm:w-56 rounded-lg" />
    </div>

    <div className="block md:hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
      {[...Array(4)].map((_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </div>

    <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
            {["User Profile", "Role", "Last Login", "Status", "Date Registered", "Actions"].map((h) => (
              <th key={h} className="px-6 py-3">
                <SkeletonBar className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <TableRowSkeleton columns={6} rows={5} />
        </tbody>
      </table>
    </div>
  </div>
);

export const UserManager = () => {
  useDocumentTitle('Users');
  const {
    currentUser, activeBlog, queryClient, searchTerm, setSearchTerm,
    showInviteModal, setShowInviteModal,
    filteredMembers, pendingInvitations, revokeInvitationMutation,
    isOwner, isLoading, updateRoleMutation, removeMutation
  } = useUserManager();

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger?: boolean;
    action: () => void;
  } | null>(null);

  if (isLoading) {
    return <UserManagerSkeleton />;
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

      {/* Empty State */}
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

      {/* Primary Table Lists Wrapper */}
      {(filteredMembers?.length ?? 0) > 0 && (
        <>
          {/* 1. Mobile Layout List Display */}
          <div className="block md:hidden space-y-3">
            {filteredMembers?.map((member) => {
              const isCurrentUser = member.user_id === currentUser?.id;
              const canRemove = isOwner && !isCurrentUser && member.role !== "owner";

              return (
                <div
                  key={member.id}
                  className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 transition-all space-y-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar firstName={member.user.first_name} lastName={member.user.last_name} size="md" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {member.user.first_name} {member.user.last_name}
                          </span>
                          {isCurrentUser && <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">you</span>}
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{member.user.username}</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{member.user.email}</span>
                      </div>
                    </div>

                    <div className="relative flex items-center gap-1.5 flex-shrink-0">
                      {isOwner ? (
                        <RoleDropdown member={member} currentUserId={currentUser?.id} onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, newRole: role })} isPending={updateRoleMutation.isPending} />
                      ) : (
                        <RoleBadge role={member.role} />
                      )}

                      <MemberActionsMenu
                        profileHref={`/admin/users/${member.user.id}`}
                        canRemove={canRemove}
                        onRemoveClick={() =>
                          setModalConfig({
                            isOpen: true,
                            title: "Remove Team Member",
                            message: `Are you sure you want to remove ${member.user.first_name} ${member.user.last_name} from this workspace?`,
                            confirmText: "Remove Member",
                            isDanger: true,
                            action: () => removeMutation.mutate(member.id),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                    <div>
                      <span className="font-medium text-zinc-400 dark:text-zinc-500 block mb-0.5">Last Activity Context:</span>
                      {member.user.last_login ? <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatSmart(member.user.last_login)}</span> : <span className="text-zinc-400 dark:text-zinc-600 italic">Never active</span>}
                    </div>
                    <div>
                      <span className="font-medium text-zinc-400 dark:text-zinc-500 block mb-0.5">Date Registered:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatLocalDate(member.user.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Desktop Table Grid View */}
          <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-xs">
            <div className="overflow-x-auto overflow-y-visible">
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
                  {filteredMembers?.map((member, index) => {
                    const isCurrentUser = member.user_id === currentUser?.id;
                    const canRemove = isOwner && !isCurrentUser && member.role !== "owner";
                    
                    // Determine placement alignment dynamically
                    const isFirstRow = index === 0;

                    return (
                      <tr key={member.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
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
                        <td className="px-6 py-4 whitespace-nowrap relative z-10">
                          {/* Pass directional context down based on row indexing */}
                          {isOwner ? (
                            <RoleDropdown 
                              member={member} 
                              currentUserId={currentUser?.id} 
                              onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, newRole: role })} 
                              isPending={updateRoleMutation.isPending} 
                              direction={isFirstRow ? "down" : "up"}
                            />
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
                        
                        <td className="px-6 py-4 text-right whitespace-nowrap relative z-10">
                          <div className="inline-block text-left">
                            <MemberActionsMenu
                              profileHref={`/admin/users/${member.user.id}`}
                              canRemove={canRemove}
                              direction={isFirstRow ? "down" : "up"}
                              onRemoveClick={() =>
                                setModalConfig({
                                  isOpen: true,
                                  title: "Remove Team Member",
                                  message: `Are you sure you want to remove ${member.user.first_name} ${member.user.last_name} from this workspace?`,
                                  confirmText: "Remove Member",
                                  isDanger: true,
                                  action: () => removeMutation.mutate(member.id),
                                })
                              }
                            />
                          </div>
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

      {isOwner && pendingInvitations.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Pending invitations</h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {pendingInvitations.length} awaiting acceptance
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {pendingInvitations.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                    <Mail size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{invite.email}</p>
                    <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <Clock size={11} /> Expires {formatLocalDate(invite.expires_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <RoleBadge role={invite.role} />
                  <button
                    onClick={() => revokeInvitationMutation.mutate(invite.id)}
                    disabled={revokeInvitationMutation.isPending}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["blogMembers", activeBlog?.id] });
          queryClient.invalidateQueries({ queryKey: ["blogInvitations", activeBlog?.id] });
        }}
      />

      <Modal
        isOpen={!!modalConfig?.isOpen}
        title={modalConfig?.title || ""}
        message={modalConfig?.message || ""}
        confirmText={modalConfig?.confirmText}
        isDanger={modalConfig?.isDanger ?? true}
        onClose={() => setModalConfig(null)}
        onConfirm={() => {
          if (modalConfig?.action) modalConfig.action();
          setModalConfig(null);
        }}
      />
    </div>
  );
};