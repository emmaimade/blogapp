import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../../shared/api/client';
import toast from 'react-hot-toast';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog, type BlogMembership } from '../../../app/providers/BlogProvider';
import {
  getAdminCapabilities,
  ADMIN_CAPABILITIES,
  type AdminCapability,
} from "../../auth/lib/accessControl";
import { Modal } from '../../../shared/components/Modal';
import { Shield, ShieldAlert, CheckCircle2, XCircle, Layout, FileText, Settings, LogOut, type LucideIcon } from 'lucide-react';
import type { AuthUser } from '../../auth/types';

interface WorkspacesTabProps {
  targetUser: AuthUser | null;
  isSuperadmin: boolean;
}

// Map technical keys to beautifully polished UI labels
const CAPABILITY_LABELS: Record<AdminCapability, { label: string; icon: LucideIcon; category: 'core' | 'content' | 'admin' }> = {
  access_admin_studio: { label: "Access Studio", icon: Layout, category: 'core' },
  view_dashboard: { label: "View Analytics Dashboard", icon: Layout, category: 'core' },
  manage_posts: { label: "Write & Publish Posts", icon: FileText, category: 'content' },
  manage_tags: { label: "Manage Taxonomies & Tags", icon: FileText, category: 'content' },
  manage_comments: { label: "Moderate Comments", icon: FileText, category: 'content' },
  manage_users: { label: "Invite & Manage Team", icon: Settings, category: 'admin' },
  manage_settings: { label: "Alter Blog Settings", icon: Settings, category: 'admin' },
  view_audit_logs: { label: "Inspect Audit Trails", icon: Settings, category: 'admin' },
  view_platform_stats: { label: "View Global Platform Stats", icon: ShieldAlert, category: 'admin' },
};

export default function WorkspacesTab({ targetUser, isSuperadmin }: WorkspacesTabProps) {
  const queryClient = useQueryClient();
  const { user: currentUser, refreshUser } = useAuth();
  const { activeBlog, routeSlug } = useBlog();
  const navigate = useNavigate();
  const isOwnProfile = !!targetUser && targetUser.id === currentUser?.id;
  const [leaving, setLeaving] = useState<BlogMembership | null>(null);

  const leaveMutation = useMutation({
    mutationFn: async (membership: BlogMembership) => api.delete(`/blogs/${membership.blog_id}/members/me`),
    onSuccess: async (_response, membership) => {
      setLeaving(null);
      await refreshUser();
      if (targetUser?.id) queryClient.invalidateQueries({ queryKey: ['user-detail', targetUser.id] });
      toast.success(`You left ${membership.blog.name}.`);
      // Still inside the workspace we just left: go wherever /admin lands now.
      if (routeSlug === membership.blog.slug) navigate('/admin', { replace: true });
    },
    onError: (error) => {
      setLeaving(null);
      toastApiError(error, 'Failed to leave the workspace.');
    },
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    blogId: number;
    membershipId: number;
    newValue: string;
    currentValue: string;
    workspaceName: string;
  } | null>(null);

  const updateRoleMutation = useMutation({
    mutationFn: async (payload: { blogId: number; membershipId: number; role: string }) => {
      return api.patch(`/blogs/${payload.blogId}/members/${payload.membershipId}`, { role: payload.role });
    },
    onSuccess: () => {
      const userId = targetUser?.id;
      if (userId) queryClient.invalidateQueries({ queryKey: ['user-detail', userId] });
      
      // Keep the UserManager list updated if the user edited a member within their current workspace
      if (activeBlog?.id) {
        queryClient.invalidateQueries({ queryKey: ["blogMembers", activeBlog.id] });
      }

      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] }); 

      toast.success('Workspace role updated successfully!');
      setConfirmModal(null);
    },
    onError: (error) => {
      toastApiError(error, 'Failed to update workspace role.');
      setConfirmModal(null);
    }
  });

  const handleRoleSelectChange = (membership: BlogMembership, newRole: string) => {
    if (membership.role === newRole) return;
    setConfirmModal({
      isOpen: true,
      blogId: membership.blog_id,
      membershipId: membership.id,
      newValue: newRole,
      currentValue: membership.role,
      workspaceName: membership.blog.name
    });
  };

  const executeConfirmedChange = () => {
    if (!confirmModal) return;

    updateRoleMutation.mutate({
      blogId: confirmModal.blogId,
      membershipId: confirmModal.membershipId,
      role: confirmModal.newValue
    });
  };

  const spaceMemberships: BlogMembership[] = targetUser?.blog_memberships || [];

  if (spaceMemberships.length === 0) {
    return (
      <div className="flex h-[200px] w-full flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-400">No active workspace assignments found for this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {spaceMemberships.map((membership: BlogMembership) => {
        const allowedCapabilities = getAdminCapabilities(targetUser, membership);

        // Find if the currently logged-in user is an 'owner' within THIS specific loop-rendered workspace
        const currentLoggedInUserRoleInThisBlog = currentUser?.blog_memberships?.find(
          (m) => m.blog_id === membership.blog_id
        )?.role;

        const isOwnerOfThisBlog = currentLoggedInUserRoleInThisBlog === 'owner';
        
        // Grant write access if they are global Superadmin OR an explicit Owner of this specific workspace partition
        const canManageThisWorkspace = isSuperadmin || isOwnerOfThisBlog;

        return (
          <div
            key={membership.id}
            className="overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 shadow-sm"
          >
            {/* Header section with profile scope context */}
            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {membership.blog?.name || "Unnamed Space"}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Tenant Authorization Group
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs text-zinc-400 font-medium mr-1">Workspace Role:</span>
                {/* Ownership moves only through "Make owner" on the Team page. */}
                {canManageThisWorkspace && membership.role !== 'owner' ? (
                  <select
                    value={membership.role}
                    onChange={(e) => handleRoleSelectChange(membership, e.target.value)}
                    className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 font-semibold text-zinc-800 dark:text-zinc-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer"
                  >
                    <option value="author">Author</option>
                    <option value="editor">Editor</option>
                  </select>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize tracking-wide">
                    {membership.role}
                  </span>
                )}
                {isOwnProfile && membership.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => setLeaving(membership)}
                    className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOut size={13} /> Leave workspace
                  </button>
                )}
              </div>
            </div>

            {/* Grid presentation layout organized by functionality scope */}
            <div className="p-5 space-y-4">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Assigned Role Privileges Summary
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ADMIN_CAPABILITIES.map((capability: AdminCapability) => {
                  const isAllowed = allowedCapabilities.has(capability);
                  const config = CAPABILITY_LABELS[capability] || { label: capability, icon: Layout };
                  const IconComponent = config.icon;

                  return (
                    <div
                      key={capability}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                        isAllowed
                          ? "border-violet-500/20 dark:border-violet-500/10 bg-violet-50/30 dark:bg-violet-950/5 text-zinc-800 dark:text-zinc-200"
                          : "border-zinc-100 dark:border-zinc-900 bg-zinc-50/10 dark:bg-zinc-900/5 text-zinc-400 dark:text-zinc-600 opacity-65"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComponent className={`h-4 w-4 flex-shrink-0 ${isAllowed ? 'text-violet-600 dark:text-violet-500' : 'text-zinc-400'}`} />
                        <span className="text-xs font-medium truncate">
                          {config.label}
                        </span>
                      </div>
                      
                      <div>
                        {isAllowed ? (
                          <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-zinc-300 dark:text-zinc-700 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <Modal
        isOpen={!!leaving}
        title={`Leave ${leaving?.blog.name ?? 'workspace'}?`}
        message={`You'll lose access to ${leaving?.blog.name ?? 'this workspace'}. An owner would need to invite you again.`}
        confirmText={leaveMutation.isPending ? 'Leaving…' : 'Leave workspace'}
        isDanger
        autoClose={false}
        onClose={() => setLeaving(null)}
        onConfirm={() => leaving && !leaveMutation.isPending && leaveMutation.mutate(leaving)}
      />

      <Modal
        isOpen={!!confirmModal?.isOpen}
        title="Confirm Workspace Assignment Change"
        isDanger={false}
        confirmText={updateRoleMutation.isPending ? "Updating..." : "Confirm Role Update"}
        onClose={() => setConfirmModal(null)}
        onConfirm={executeConfirmedChange}
        autoClose={false}
        message={`Are you sure you want to alter this user's role in ${confirmModal?.workspaceName} from "${confirmModal?.currentValue}" to "${confirmModal?.newValue}"? This will dynamically reconfigure all fine-grained privileges associated with this account context.`}
      />
    </div>
  );
}