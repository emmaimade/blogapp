import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Search,
  Shield,
  Trash2,
  Users,
  ChevronDown,
  Crown,
  Pencil,
  BookOpen,
  X,
  Loader2,
  Copy,
  Check,
  Link2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';

type BlogRole = 'owner' | 'editor' | 'author';

interface BlogMember {
  id: number;
  user_id: number;
  blog_id: number;
  role: BlogRole;
  invited_at: string;
  user: {
    id: number;
    username: string;
    email: string;
    created_at: string;
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────

const ROLES: BlogRole[] = ['owner', 'editor', 'author'];

const ROLE_META: Record<BlogRole, { label: string; icon: React.ComponentType<{ size: number; className?: string }>; color: string }> = {
  owner:       { label: 'Owner',       icon: Crown,    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  editor:      { label: 'Editor',      icon: Pencil,   color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  author:      { label: 'Author',      icon: BookOpen, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
};

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500',   'bg-amber-500', 'bg-cyan-500', 'bg-pink-500',
];

const getAvatarColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const Avatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) => {
  const color = getAvatarColor(name);
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${color} ${dim}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

const RoleBadge = ({ role }: { role: BlogRole }) => {
  const { label, icon: Icon, color } = ROLE_META[role];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      <Icon size={11} />
      {label}
    </span>
  );
};

// ─── Invite Modal (Shareable Link) ───────────────────────────────────────────

const SITE_URL = import.meta.env.VITE_SITE_URL || 'http://localhost:5174';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteModal = ({ isOpen, onClose, onSuccess }: InviteModalProps) => {
  const [role, setRole] = useState<BlogRole>('author');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await api.post('/invitations', { role });
      const token: string = res.data.token;
      setGeneratedLink(`${SITE_URL}/join/${token}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate invite link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedLink('');
    setRole('author');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Invite team member</h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Generate a link to share with anyone — valid for 7 days.
            </p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {/* Generated link display */}
        {generatedLink ? (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Check size={15} />
              Invite link generated for <RoleBadge role={role} />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <Link2 size={14} className="flex-shrink-0 text-zinc-400" />
              <span className="flex-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{generatedLink}</span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  copied ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-600 text-white hover:bg-violet-700'
                }`}
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock size={11} />
              This link expires in 7 days. Share it privately — anyone with this link can join as <strong>{role}</strong>.
            </p>
          </div>
        ) : null}

        {!generatedLink && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['editor', 'author'] as BlogRole[]).map((r) => {
                  const { label, icon: Icon } = ROLE_META[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center text-xs font-semibold transition-all ${
                        role === r
                          ? 'border-violet-400 bg-violet-50 text-violet-800 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300'
                          : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {role === 'editor' && 'Can manage posts, tags, and comments.'}
                {role === 'author' && 'Can write and manage their own posts.'}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                {isLoading ? 'Generating...' : 'Generate Invite Link'}
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

// ─── Inline Role Dropdown ─────────────────────────────────────────────────────

interface RoleDropdownProps {
  member: BlogMember;
  currentUserId?: number;
  onRoleChange: (memberId: number, role: BlogRole) => void;
  isPending: boolean;
}

const RoleDropdown = ({ member, currentUserId, onRoleChange, isPending }: RoleDropdownProps) => {
  const [open, setOpen] = useState(false);
  const isLocked = member.role === 'owner' || member.user_id === currentUserId;

  if (isLocked) return <RoleBadge role={member.role} />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:ring-2 hover:ring-violet-400/40 disabled:opacity-50 focus:outline-none"
      >
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_META[member.role].color}`}>
          {(() => { const Icon = ROLE_META[member.role].icon; return <Icon size={11} />; })()}
          {ROLE_META[member.role].label}
        </span>
        <ChevronDown size={12} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-40 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {ROLES.filter(r => r !== 'owner').map((r) => {
              const { label, icon: Icon, color } = ROLE_META[r];
              return (
                <button
                  key={r}
                  onClick={() => { onRoleChange(member.id, r); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${member.role === r ? 'text-violet-700 dark:text-violet-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                >
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${color}`}>
                    <Icon size={10} />
                  </span>
                  {label}
                  {member.role === r && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const UserManager = () => {
  const { user: currentUser } = useAuth();
  const { activeBlog } = useBlog();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const { data: members, isLoading } = useQuery<BlogMember[]>({
    queryKey: ['blogMembers', activeBlog?.id],
    queryFn: async () => (await api.get('/members')).data,
    enabled: !!activeBlog,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, newRole }: { memberId: number; newRole: BlogRole }) =>
      api.patch(`/members/${memberId}`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogMembers', activeBlog?.id] });
      toast.success('Role updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => api.delete(`/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogMembers', activeBlog?.id] });
      setRemovingId(null);
      toast.success('Member removed');
    },
    onError: (error: any) => {
      setRemovingId(null);
      toast.error(error.response?.data?.detail || 'Failed to remove member');
    },
  });

  const filteredMembers = members?.filter(
    (m) =>
      m.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const isOwner = members?.some(
    (m) => m.user_id === currentUser?.id && m.role === 'owner',
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400" size={28} />
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            {activeBlog?.name ?? 'Workspace'} Team
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
            <input
              type="text"
              placeholder="Search members..."
              className="h-9 w-52 rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Invite button — owners only */}
          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              <UserPlus size={15} />
              <span className="hidden sm:inline">Invite member</span>
              <span className="sm:hidden">Invite</span>
            </button>
          )}
        </div>
      </div>

      {/* Role legend */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ROLES.map((r) => <RoleBadge key={r} role={r} />)}
      </div>

      {/* Empty state */}
      {(filteredMembers?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 dark:border-zinc-800">
          <Users className="mb-3 text-zinc-300 dark:text-zinc-700" size={40} />
          {searchTerm ? (
            <>
              <p className="font-semibold text-zinc-600 dark:text-zinc-400">No members match "{searchTerm}"</p>
              <button onClick={() => setSearchTerm('')} className="mt-2 text-sm text-violet-600 hover:underline dark:text-violet-400">
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-zinc-600 dark:text-zinc-400">It's just you so far</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">Invite a teammate to collaborate on {activeBlog?.name}.</p>
              {isOwner && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  <UserPlus size={15} />
                  Invite your first team member
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Members list */}
      {(filteredMembers?.length ?? 0) > 0 && (
        <div className="admin-card divide-y divide-zinc-100 overflow-hidden rounded-2xl dark:divide-zinc-800">
          {filteredMembers?.map((member) => {
            const isCurrentUser = member.user_id === currentUser?.id;
            const canRemove = isOwner && !isCurrentUser && member.role !== 'owner';
            const isConfirmingRemove = removingId === member.id;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
              >
                {/* Avatar */}
                <Avatar name={member.user.username} />

                {/* Name / email */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-zinc-900 dark:text-white">
                      {member.user.username}
                    </span>
                    {isCurrentUser && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        you
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-zinc-500 dark:text-zinc-400">{member.user.email}</div>
                </div>

                {/* Joined date */}
                <div className="hidden text-right text-xs text-zinc-400 lg:block">
                  <div className="font-medium text-zinc-500 dark:text-zinc-400">Joined</div>
                  <div>{new Date(member.invited_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>

                {/* Role */}
                <div className="flex-shrink-0">
                  {isOwner ? (
                    <RoleDropdown
                      member={member}
                      currentUserId={currentUser?.id}
                      onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, newRole: role })}
                      isPending={updateRoleMutation.isPending}
                    />
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </div>

                {/* Remove action */}
                {canRemove && (
                  <div className="flex-shrink-0">
                    {isConfirmingRemove ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Remove?</span>
                        <button
                          onClick={() => removeMutation.mutate(member.id)}
                          disabled={removeMutation.isPending}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {removeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Yes'}
                        </button>
                        <button
                          onClick={() => setRemovingId(null)}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRemovingId(member.id)}
                        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        title="Remove member"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )}

                {/* Shield icon for non-removable own row */}
                {!canRemove && !isConfirmingRemove && member.role !== 'owner' && (
                  <Shield size={15} className="flex-shrink-0 text-zinc-300 dark:text-zinc-700" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['blogMembers', activeBlog?.id] })}
      />
    </div>
  );
};
