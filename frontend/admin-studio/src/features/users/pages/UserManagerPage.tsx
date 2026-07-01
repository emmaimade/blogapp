import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Shield,
  Trash2,
  Users,
  ChevronDown,
  X,
  Loader2,
  Copy,
  Check,
  Link2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../shared/api/client";
import { formatSmart, formatLocalDate } from "../../../shared/utils/dates";
import { useAuth } from "../../auth/context/AuthContext";
import { useBlog } from "../../../app/providers/BlogProvider";

type BlogRole = "owner" | "editor" | "author";

interface BlogMember {
  id: number;
  user_id: number;
  blog_id: number;
  role: BlogRole;
  invited_at: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
    last_login: string | null;
  };
}

const ROLES: BlogRole[] = ["owner", "editor", "author"];

const ROLE_META: Record<BlogRole, { label: string; color: string }> = {
  owner: {
    label: "Owner",
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50 shadow-2xs",
  },
  editor: {
    label: "Editor",
    color:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/50 shadow-2xs",
  },
  author: {
    label: "Author",
    color:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/50 shadow-2xs",
  },
};

const Avatar = ({
  firstName,
  lastName,
  size = "md",
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "md";
}) => {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/50 shadow-2xs ${dim}`}
    >
      {initials}
    </div>
  );
};

const RoleBadge = ({ role }: { role: BlogRole }) => {
  const { label, color } = ROLE_META[role];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border shadow-2xs capitalize ${color}`}
    >
      {label}
    </span>
  );
};

const SITE_URL = import.meta.env.VITE_SITE_URL || "http://localhost:5174";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteModal = ({ isOpen, onClose, onSuccess }: InviteModalProps) => {
  const [role, setRole] = useState<BlogRole>("author");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await api.post("/invitations", { role });
      const token: string = res.data.token;
      setGeneratedLink(`${SITE_URL}/join/${token}`);
      onSuccess();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to generate invite link.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedLink("");
    setRole("author");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Invite team member
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Generate a link to share with anyone — valid for 7 days.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {generatedLink ? (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Check size={15} />
              Invite link generated for <RoleBadge role={role} />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <Link2 size={14} className="flex-shrink-0 text-zinc-400" />
              <span className="flex-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">
                {generatedLink}
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-violet-600 text-white hover:bg-violet-700"
                }`}
              >
                {copied ? (
                  <>
                    <Check size={12} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock size={11} />
              This link expires in 7 days. Share it privately.
            </p>
          </div>
        ) : null}

        {!generatedLink && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["editor", "author"] as BlogRole[]).map((r) => {
                  const { label } = ROLE_META[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-3.5 text-center text-xs font-semibold transition-all ${
                        role === r
                          ? "border-violet-500 bg-violet-5/50 text-violet-800 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="text-sm font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {role === "editor" && "Can manage posts, tags, and comments."}
                {role === "author" && "Can write and manage their own posts."}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Link2 size={15} />
                )}
                {isLoading ? "Generating..." : "Generate Invite Link"}
              </button>
            </div>
          </div>
        )}

        {generatedLink && (
          <button
            type="button"
            onClick={handleClose}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

interface RoleDropdownProps {
  member: BlogMember;
  currentUserId?: number;
  onRoleChange: (memberId: number, role: BlogRole) => void;
  isPending: boolean;
}

const RoleDropdown = ({
  member,
  currentUserId,
  onRoleChange,
  isPending,
}: RoleDropdownProps) => {
  const [open, setOpen] = useState(false);
  const isLocked = member.role === "owner" || member.user_id === currentUserId;

  if (isLocked) return <RoleBadge role={member.role} />;

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none"
      >
        <RoleBadge role={member.role} />
        <ChevronDown
          size={12}
          className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 origin-top-right rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {ROLES.filter((r) => r !== "owner").map((r) => {
              const { label, color } = ROLE_META[r];
              return (
                <button
                  key={r}
                  onClick={() => {
                    onRoleChange(member.id, r);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${member.role === r ? "text-violet-700 dark:text-violet-400" : "text-zinc-700 dark:text-zinc-300"}`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${color}`}
                  >
                    <span className="text-3xs font-bold uppercase">
                      {label.charAt(0)}
                    </span>
                  </span>
                  {label}
                  {member.role === r && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const UserManager = () => {
  const { user: currentUser } = useAuth();
  const { activeBlog } = useBlog();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const { data: members, isLoading } = useQuery<BlogMember[]>({
    queryKey: ["blogMembers", activeBlog?.id],
    queryFn: async () => (await api.get("/members")).data,
    enabled: !!activeBlog,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      newRole,
    }: {
      memberId: number;
      newRole: BlogRole;
    }) => api.patch(`/members/${memberId}`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["blogMembers", activeBlog?.id],
      });
      toast.success("Role updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update role");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => api.delete(`/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["blogMembers", activeBlog?.id],
      });
      setRemovingId(null);
      toast.success("Member removed from workspace");
    },
    onError: (error: any) => {
      setRemovingId(null);
      toast.error(error.response?.data?.detail || "Failed to remove member");
    },
  });

  const filteredMembers = members?.filter(
    (m) =>
      m.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const isOwner = members?.some(
    (m) => m.user_id === currentUser?.id && m.role === "owner",
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={28} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Meta Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {activeBlog?.name ?? "Workspace"} Team
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your workspace member configuration roles, view activity
            logs, and issue invitation links.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              size={15}
            />
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
              <p className="font-semibold text-zinc-600 dark:text-zinc-400">
                No members match "{searchTerm}"
              </p>
              <button
                onClick={() => setSearchTerm("")}
                className="mt-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline decoration-dotted"
              >
                Clear active filter search
              </button>
            </>
          ) : (
            <p className="font-semibold text-zinc-600 dark:text-zinc-400">
              No members added to this team workspace.
            </p>
          )}
        </div>
      )}

      {/* Main Responsive Views Wrapper */}
      {(filteredMembers?.length ?? 0) > 0 && (
        <>
          {/* 1. Mobile Card Layout: Hidden on Tablet/Desktop screens */}
          <div className="block md:hidden space-y-3">
            {filteredMembers?.map((member) => {
              const isCurrentUser = member.user_id === currentUser?.id;
              const canRemove =
                isOwner && !isCurrentUser && member.role !== "owner";
              const isConfirmingRemove = removingId === member.id;

              return (
                <div
                  key={member.id}
                  className={`p-4 border rounded-xl bg-white dark:bg-zinc-900 transition-all space-y-3 shadow-xs ${
                    isConfirmingRemove
                      ? "border-red-200 dark:border-red-900/60 bg-red-50/5 dark:bg-red-950/5"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        firstName={member.user.first_name}
                        lastName={member.user.last_name}
                        size="md"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                          {member.user.first_name} {member.user.last_name}
                          {isCurrentUser && (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                              you
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          @{member.user.username}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                          {member.user.email}
                        </span>
                      </div>
                    </div>

                    {/* Role Placement Configuration */}
                    <div className="flex-shrink-0">
                      {isOwner ? (
                        <RoleDropdown
                          member={member}
                          currentUserId={currentUser?.id}
                          onRoleChange={(id, role) =>
                            updateRoleMutation.mutate({
                              memberId: id,
                              newRole: role,
                            })
                          }
                          isPending={updateRoleMutation.isPending}
                        />
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </div>
                  </div>

                  {/* Context Metrics Bottom Bar Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                    <div className="text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-400 block">
                        Last Activity Context:
                      </span>
                      {member.user.last_login ? (
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {formatSmart(member.user.last_login)}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600 italic">
                          Never logged in
                        </span>
                      )}
                    </div>

                    {/* Mobile Context-aware Action Center */}
                    <div className="flex-shrink-0">
                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-lg p-1">
                          <button
                            onClick={() => removeMutation.mutate(member.id)}
                            disabled={removeMutation.isPending}
                            className="rounded bg-red-600 px-2 py-1 text-2xs font-bold text-white hover:bg-red-700"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setRemovingId(null)}
                            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-2xs font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : canRemove ? (
                        <button
                          onClick={() => setRemovingId(member.id)}
                          className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors inline-flex items-center gap-1 font-medium"
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      ) : (
                        <div
                          className="p-2 text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                          title="Actions Protected"
                        >
                          <Shield size={14} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Structured Desktop Matrix Table View: Hidden on Mobile viewports */}
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
                    const canRemove =
                      isOwner && !isCurrentUser && member.role !== "owner";
                    const isConfirmingRemove = removingId === member.id;

                    return (
                      <tr
                        key={member.id}
                        className={`group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors ${
                          isConfirmingRemove
                            ? "bg-red-50/10 dark:bg-red-950/5"
                            : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              firstName={member.user.first_name}
                              lastName={member.user.last_name}
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  to={`/admin/users/${member.user.id}`}
                                  className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline hover:text-zinc-600 dark:hover:text-zinc-300 block truncate"
                                >
                                  {member.user.first_name}{" "}
                                  {member.user.last_name}
                                </Link>

                                {isCurrentUser && (
                                  <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 tracking-wider select-none">
                                    you
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                @{member.user.username}{" "}
                                <span className="text-zinc-300 dark:text-zinc-700 mx-1">
                                  •
                                </span>{" "}
                                {member.user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {isOwner ? (
                            <RoleDropdown
                              member={member}
                              currentUserId={currentUser?.id}
                              onRoleChange={(id, role) =>
                                updateRoleMutation.mutate({
                                  memberId: id,
                                  newRole: role,
                                })
                              }
                              isPending={updateRoleMutation.isPending}
                            />
                          ) : (
                            <RoleBadge role={member.role} />
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                          {member.user.last_login ? (
                            <span
                              title={member.user.last_login}
                              className="cursor-help border-b border-dotted border-zinc-300 dark:border-zinc-700 pb-0.5"
                            >
                              {formatSmart(member.user.last_login)}
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600 italic">
                              Never logged in
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30">
                            Active
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">
                          {formatLocalDate(member.user.created_at)}
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {isConfirmingRemove ? (
                            <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg p-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                              <AlertTriangle
                                size={13}
                                className="text-red-600 flex-shrink-0"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    removeMutation.mutate(member.id)
                                  }
                                  disabled={removeMutation.isPending}
                                  className="rounded bg-red-600 px-2 py-0.5 text-2xs font-medium text-white hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setRemovingId(null)}
                                  className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-0.5 text-2xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : canRemove ? (
                            <button
                              onClick={() => setRemovingId(member.id)}
                              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors inline-flex items-center justify-center"
                              title="Remove from Workspace"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <div
                              className="p-1.5 inline-flex items-center justify-center text-zinc-300 dark:text-zinc-700 select-none cursor-not-allowed"
                              title={
                                isCurrentUser
                                  ? "You cannot modify your own profile actions here."
                                  : "Only workspace owners can remove members."
                              }
                            >
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

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: ["blogMembers", activeBlog?.id],
          })
        }
      />
    </div>
  );
};
