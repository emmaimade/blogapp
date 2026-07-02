import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Modal } from '../../../shared/components/Modal';

interface WorkspaceMembership {
  id: number;
  blog_id: number;
  role: 'owner' | 'editor' | 'viewer';
  permissions: {
    can_publish: boolean;
    can_delete_comments: boolean;
    can_manage_settings: boolean;
  };
  blog: { name: string };
}

export default function WorkspacesTab({ targetUser, isSuperadmin, isBlogOwner }: any) {
  const queryClient = useQueryClient();
  
  // Clean structure to manage selection targets before saving
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    membershipId: number;
    type: 'role' | 'permission';
    targetField: string;
    newValue: any;
    currentValue: any;
    workspaceName: string;
  } | null>(null);

  const updatePermissionMutation = useMutation({
    mutationFn: async (payload: { membershipId: number; role?: string; permissions?: any }) => {
      const token = localStorage.getItem('token');
      return axios.patch(`/api/memberships/${payload.membershipId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
      toast.success('Permissions updated successfully!');
      setConfirmModal(null);
    },
    onError: () => {
      toast.error('Failed to update workspace permissions.');
    }
  });

  const handleRoleSelectChange = (membership: WorkspaceMembership, newRole: string) => {
    if (membership.role === newRole) return;
    
    setConfirmModal({
      isOpen: true,
      membershipId: membership.id,
      type: 'role',
      targetField: 'role',
      newValue: newRole,
      currentValue: membership.role,
      workspaceName: membership.blog.name
    });
  };

  const handleToggleClick = (membership: WorkspaceMembership, permissionKey: string, currentVal: boolean) => {
    setConfirmModal({
      isOpen: true,
      membershipId: membership.id,
      type: 'permission',
      targetField: permissionKey,
      newValue: !currentVal,
      currentValue: currentVal,
      workspaceName: membership.blog.name
    });
  };

  const executeConfirmedChange = () => {
    if (!confirmModal) return;

    if (confirmModal.type === 'role') {
      updatePermissionMutation.mutate({
        membershipId: confirmModal.membershipId,
        role: confirmModal.newValue
      });
    } else {
      const activeMembership = targetUser.blog_memberships.find((m: any) => m.id === confirmModal.membershipId);
      const updatedPermissions = {
        ...activeMembership.permissions,
        [confirmModal.targetField]: confirmModal.newValue
      };

      updatePermissionMutation.mutate({
        membershipId: confirmModal.membershipId,
        permissions: updatedPermissions
      });
    }
  };

  const canManage = isSuperadmin || isBlogOwner;

  return (
    <div className="space-y-6 relative">
      {targetUser?.blog_memberships?.map((membership: WorkspaceMembership) => (
        <div key={membership.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{membership.blog.name}</h4>
              <p className="text-[11px] text-zinc-400">Workspace Tenant Scope</p>
            </div>

            {canManage ? (
              <select
                value={membership.role}
                onChange={(e) => handleRoleSelectChange(membership, e.target.value as any)}
                className="text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 capitalize">
                {membership.role}
              </span>
            )}
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Fine-Grained Capabilities</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(membership.permissions || {}).map(([key, value]) => {
                const formattedLabel = key.replace('can_', '').replace('_', ' ');
                return (
                  <label 
                    key={key} 
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${!canManage ? 'opacity-60 cursor-not-allowed' : ''} ${value ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/20' : 'border-zinc-100 dark:border-zinc-800'}`}
                  >
                    <span className="capitalize text-zinc-600 dark:text-zinc-400">{formattedLabel}</span>
                    <input
                      type="checkbox"
                      checked={!!value}
                      disabled={!canManage}
                      onChange={() => handleToggleClick(membership, key, !!value)}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 h-3.5 w-3.5"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Clean shared modal replacement logic[cite: 10, 11] */}
      <Modal
        isOpen={!!confirmModal?.isOpen}
        title="Confirm Permission Restructure"
        isDanger={false} // Uses clean non-destructive layout styling tokens[cite: 10]
        confirmText={updatePermissionMutation.isPending ? "Saving..." : "Confirm Change"}
        onClose={() => setConfirmModal(null)}
        onConfirm={executeConfirmedChange}
        message={
          confirmModal?.type === 'role'
            ? `Are you sure you want to alter this user's role in ${confirmModal.workspaceName} from "${confirmModal.currentValue}" to "${confirmModal.newValue}"? This will shift their baseline system visibility thresholds.`
            : `Are you sure you want to change the "${confirmModal?.targetField?.replace('can_', '').replace('_', ' ')}" rule to ${confirmModal?.newValue ? 'ENABLED' : 'DISABLED'} for the ${confirmModal?.workspaceName} partition?`
        }
      />
    </div>
  );
}