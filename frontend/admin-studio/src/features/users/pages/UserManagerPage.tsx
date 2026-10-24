import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Search, Users, Mail, MoreHorizontal } from "lucide-react";
import { formatSmart, formatLocalDate } from "../../../shared/utils/dates";
import { useUserManager, type BlogMember, type BlogRole } from "../hooks/useUserManager";
import { InviteModal } from "../components/InviteModal";
import { Avatar, RoleBadge, RoleDropdown, MemberActionsMenu, MemberActionSheet, ROLE_META } from "../components/UserComponents";
import { Modal } from "../../../shared/components/Modal";
import { SkeletonBar, SkeletonListRow, TableRowSkeleton } from "../../../shared/ui/Skeleton";
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';

const UserManagerSkeleton = () => (
  <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-48" />
        <SkeletonBar className="h-4 w-36" />
      </div>
      <SkeletonBar className="h-10 w-24 sm:w-36 rounded-lg" />
    </div>
    <SkeletonBar className="h-11 w-full sm:h-10 sm:w-80 rounded-lg" />

    <div className="block md:hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
      {[...Array(5)].map((_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </div>

    <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
            {["Member", "Role", "Last login", "Joined", "Actions"].map((h) => (
              <th key={h} className="px-6 py-3">
                <SkeletonBar className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <TableRowSkeleton columns={5} rows={5} />
        </tbody>
      </table>
    </div>
  </div>
);

const lastSeen = (iso: string | null) => (iso ? `Last seen ${formatSmart(iso)}` : "Never logged in");

export const UserManager = () => {
  const toWorkspace = useWorkspacePath();
  useDocumentTitle('Users');
  const {
    currentUser, activeBlog, queryClient, searchTerm, setSearchTerm,
    showInviteModal, setShowInviteModal,
    filteredMembers, pausedCount, pendingInvitations, revokeInvitationMutation,
    isOwner, isLoading, updateRoleMutation, updatePermissionsMutation, removeMutation, transferOwnershipMutation
  } = useUserManager();

  const toggleExportFollowers = (member: BlogMember) =>
    updatePermissionsMutation.mutate({
      memberId: member.id,
      permissions: { ...member.permissions, export_followers: !member.permissions?.export_followers },
    });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger?: boolean;
    action: () => void;
  } | null>(null);

  // Mobile: the member whose action sheet is open.
  const [sheetMember, setSheetMember] = useState<BlogMember | null>(null);
  const closeSheet = useCallback(() => setSheetMember(null), []);
  const invitesRef = useRef<HTMLDivElement | null>(null);

  const fullName = (member: BlogMember) => `${member.user.first_name} ${member.user.last_name}`;

  const askToMakeOwner = (member: BlogMember) =>
    setModalConfig({
      isOpen: true,
      title: "Transfer ownership",
      message:
        `Make ${fullName(member)} the owner of ${activeBlog?.name ?? "this workspace"}?

` +
        "They'll take over the plan and billing, and you'll become an editor. Only the new owner can undo this.",
      confirmText: "Make owner",
      isDanger: true,
      action: () => transferOwnershipMutation.mutate(member.id),
    });

  const askToRemove = (member: BlogMember) =>
    setModalConfig({
      isOpen: true,
      title: "Remove member",
      message: `Remove ${fullName(member)} from ${activeBlog?.name ?? "this workspace"}? They'll lose access right away and would need a new invitation to come back.`,
      confirmText: "Remove member",
      isDanger: true,
      action: () => removeMutation.mutate(member.id),
    });

  // Role changes alter what someone can do, so they're confirmed rather than
  // applied on the tap - easy to fat-finger on a phone.
  const askToChangeRole = (member: BlogMember, role: BlogRole) => {
    if (member.role === role) return;
    setModalConfig({
      isOpen: true,
      title: "Change role",
      message: `Change ${fullName(member)} from ${ROLE_META[member.role].label} to ${ROLE_META[role].label}?`,
      confirmText: `Make ${ROLE_META[role].label.toLowerCase()}`,
      isDanger: false,
      action: () => updateRoleMutation.mutate({ memberId: member.id, newRole: role }),
    });
  };

  const askToRevoke = (inviteId: number, email: string) =>
    setModalConfig({
      isOpen: true,
      title: "Revoke invitation",
      message: `${email} won't be able to use their invitation link any more. You can invite them again later.`,
      confirmText: "Revoke",
      isDanger: true,
      action: () => revokeInvitationMutation.mutate(inviteId),
    });

  // Opens a sheet action's confirm dialog in place of the sheet.
  const fromSheet = (fn: (member: BlogMember) => void) => () => {
    if (!sheetMember) return;
    const member = sheetMember;
    setSheetMember(null);
    fn(member);
  };

  if (isLoading) {
    return <UserManagerSkeleton />;
  }

  const memberCount = filteredMembers?.length ?? 0;
  const totalLabel = searchTerm
    ? `${memberCount} ${memberCount === 1 ? "match" : "matches"}`
    : `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
  const showInvites = isOwner && pendingInvitations.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header: title + primary action share a row at every width */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 break-words">
              {activeBlog?.name ?? "Workspace"} team
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {totalLabel}
              {showInvites && (
                <>
                  <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
                  <button
                    onClick={() => invitesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="font-medium text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {pendingInvitations.length} pending {pendingInvitations.length === 1 ? "invite" : "invites"}
                  </button>
                </>
              )}
            </p>
          </div>

          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 sm:px-4 text-sm font-medium text-white hover:bg-violet-700 shadow-xs transition-all active:scale-98"
            >
              <UserPlus size={16} />
              <span>Invite<span className="hidden sm:inline"> member</span></span>
            </button>
          )}
        </div>

        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={16} />
          {/* text-base on mobile: iOS zooms into inputs under 16px */}
          <input
            type="search"
            aria-label="Search members"
            placeholder="Search name, username or email"
            className="w-full h-11 sm:h-10 pl-9 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-base sm:text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isOwner && pausedCount > 0 && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">
              {pausedCount === 1 ? "1 member is" : `${pausedCount} members are`} paused.
            </span>{" "}
            Your workspace has more members than your plan includes, so they can view but not edit. Upgrade to
            restore their access straight away, or remove members to free up seats.
          </p>
          <Link
            to={toWorkspace("/settings/billing")}
            className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            Upgrade plan
          </Link>
        </div>
      )}

      {/* Mobile puts pending invites first (order-first) so they're not buried under a long team list */}
      <div className="flex flex-col gap-5">
        {memberCount === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-14 text-center">
            <Users className="mb-3 text-zinc-300 dark:text-zinc-700" size={40} />
            {searchTerm ? (
              <>
                <p className="font-semibold text-zinc-600 dark:text-zinc-400">No members match "{searchTerm}"</p>
                <button onClick={() => setSearchTerm("")} className="mt-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline decoration-dotted">
                  Clear search
                </button>
              </>
            ) : (
              <p className="font-semibold text-zinc-600 dark:text-zinc-400">No one else is on this team yet.</p>
            )}
          </div>
        )}

        {memberCount > 0 && (
          <>
            {/* 1. Mobile: one grouped list, two lines per member, whole row opens the profile */}
            <ul className="md:hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 shadow-xs">
              {filteredMembers?.map((member) => {
                const isCurrentUser = member.user_id === currentUser?.id;
                const canManage = isOwner && !isCurrentUser && member.role !== "owner";

                return (
                  <li key={member.id} className="flex items-center gap-1 pr-1.5">
                    <Link
                      to={toWorkspace(`/users/${member.user.id}`)}
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-zinc-50 dark:active:bg-zinc-800/40"
                    >
                      <Avatar firstName={member.user.first_name} lastName={member.user.last_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{fullName(member)}</span>
                          {isCurrentUser && <span className="flex-shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium leading-none text-zinc-600 dark:text-zinc-400">you</span>}
                          {member.access_paused && <span className="flex-shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-700 dark:text-amber-400">paused</span>}
                        </div>
                        <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                          @{member.user.username}
                          <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                          {lastSeen(member.user.last_login)}
                        </p>
                      </div>
                      <RoleBadge role={member.role} />
                    </Link>

                    {canManage ? (
                      <button
                        onClick={() => setSheetMember(member)}
                        aria-label={`Manage ${fullName(member)}`}
                        aria-haspopup="dialog"
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    ) : (
                      // Keeps role badges aligned down the list
                      <span className="w-11 flex-shrink-0" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>

            {/* 2. Desktop table */}
            <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-xs">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      <th className="px-6 py-3">Member</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Last login</th>
                      <th className="px-6 py-3">Joined</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                    {filteredMembers?.map((member, index) => {
                      const isCurrentUser = member.user_id === currentUser?.id;
                      const canRemove = isOwner && !isCurrentUser && member.role !== "owner";

                      // Every cell with a menu is its own z-10 layer, so later rows would
                      // paint over an open menu; the cell holding one (role="menu") lifts
                      // to z-30 while it's open.
                      // Menus in the top half of the table open downward and the rest
                      // upward, so a tall menu isn't clipped by the table's edge.
                      const isFirstRow = index < Math.ceil((filteredMembers?.length ?? 0) / 2);

                      return (
                        <tr key={member.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar firstName={member.user.first_name} lastName={member.user.last_name} />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link to={toWorkspace(`/users/${member.user.id}`)} className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline hover:text-zinc-600 dark:hover:text-zinc-300 block truncate">
                                    {fullName(member)}
                                  </Link>
                                  {isCurrentUser && <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 tracking-wider select-none">you</span>}
                                  {member.access_paused && <span title="Over the plan's member limit: can view, can't edit" className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 tracking-wider select-none">Paused · view only</span>}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">@{member.user.username} <span className="text-zinc-300 dark:text-zinc-700 mx-1">•</span> {member.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap relative z-10 has-[[role=menu]]:z-30">
                            {/* Pass directional context down based on row indexing */}
                            {isOwner ? (
                              <RoleDropdown
                                member={member}
                                currentUserId={currentUser?.id}
                                onRoleChange={(_id, role) => askToChangeRole(member, role)}
                                isPending={updateRoleMutation.isPending && updateRoleMutation.variables?.memberId === member.id}
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
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">{formatLocalDate(member.user.created_at)}</td>

                          <td className="px-6 py-4 text-right whitespace-nowrap relative z-10 has-[[role=menu]]:z-30">
                            <div className="inline-block text-left">
                              <MemberActionsMenu
                                profileHref={toWorkspace(`/users/${member.user.id}`)}
                                canRemove={canRemove}
                                onMakeOwnerClick={canRemove ? () => askToMakeOwner(member) : undefined}
                                canExportFollowers={!!member.permissions?.export_followers}
                                onToggleExportFollowers={isOwner && member.role === "editor" ? () => toggleExportFollowers(member) : undefined}
                                direction={isFirstRow ? "down" : "up"}
                                onRemoveClick={() => askToRemove(member)}
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

        {showInvites && (
          <div
            ref={invitesRef}
            className="order-first md:order-none scroll-mt-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Pending invitations</h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{pendingInvitations.length} waiting</span>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pendingInvitations.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                      <Mail size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{invite.email}</p>
                      <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                        {ROLE_META[invite.role].label}
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                        Expires {formatLocalDate(invite.expires_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => askToRevoke(invite.id, invite.email)}
                    disabled={revokeInvitationMutation.isPending}
                    className="h-10 sm:h-8 flex-shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-sm sm:text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <MemberActionSheet
        member={sheetMember}
        profileHref={sheetMember ? toWorkspace(`/users/${sheetMember.user.id}`) : ""}
        onClose={closeSheet}
        onRoleSelect={(role) => {
          if (!sheetMember) return;
          if (role === sheetMember.role) return closeSheet();
          fromSheet((m) => askToChangeRole(m, role))();
        }}
        onMakeOwnerClick={fromSheet(askToMakeOwner)}
        onRemoveClick={fromSheet(askToRemove)}
        onToggleExportFollowers={fromSheet(toggleExportFollowers)}
      />

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
