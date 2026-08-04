import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/api/client';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import toast from 'react-hot-toast';

export type BlogRole = "owner" | "editor" | "author";

export interface BlogMember {
  id: number;
  user_id: number;
  blog_id: number;
  role: BlogRole;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    last_login: string | null;
    created_at: string;
  };
}

export interface BlogInvitation {
  id: number;
  blog_id: number;
  email: string;
  role: BlogRole;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export const useUserManager = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { activeBlog, activeRole } = useBlog();
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isOwner = activeRole === 'owner';

  // 1. Fetch all members of the active workspace
  const { data: members = [], isLoading } = useQuery<BlogMember[]>({
    queryKey: ['blogMembers', activeBlog?.id],
    queryFn: async () => {
      const res = await api.get(`/blogs/${activeBlog?.id}/members`);
      return res.data;
    },
    enabled: !!activeBlog?.id,
  });

  // 2b. Fetch pending invitations for the active workspace (owner only)
  const { data: pendingInvitations = [] } = useQuery<BlogInvitation[]>({
    queryKey: ['blogInvitations', activeBlog?.id],
    queryFn: async () => {
      const res = await api.get(`/blogs/${activeBlog?.id}/invitations`);
      return res.data;
    },
    enabled: !!activeBlog?.id && isOwner,
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      if (!activeBlog?.id) throw new Error("No active workspace selected.");
      return api.delete(`/blogs/${activeBlog.id}/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogInvitations', activeBlog?.id] });
      toast.success('Invitation revoked.');
    },
    onError: () => {
      toast.error('Failed to revoke invitation.');
    },
  });

  // 2. Mutation to update a user's role (with cross-invalidation!)
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: number; newRole: string }) => {
      if (!activeBlog?.id) throw new Error("No active workspace selected.");
      return api.patch(`/blogs/${activeBlog.id}/members/${memberId}`, { role: newRole });
    },
    onSuccess: (_response, variables) => {
      // Find the updated member in our local cache to get their user_id
      const updatedMember = members.find((m) => m.id === variables.memberId);
      const targetUserId = updatedMember?.user_id;

      // INVALIDATION 1: Update the workspace team list UI
      queryClient.invalidateQueries({ queryKey: ['blogMembers', activeBlog?.id] });

      // INVALIDATION 2: Update the specific user detail cache (makes the WorkspacesTab dynamic!)
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: ['user-detail', targetUserId] });
      }

      // Optional global cleanups
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      queryClient.invalidateQueries({ queryKey: ['current-user'] });

      toast.success('Member role updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update member role.');
    },
  });

  // 3. Mutation to remove a team member
  const removeMutation = useMutation({
    mutationFn: async (memberId: number) => {
      if (!activeBlog?.id) throw new Error("No active workspace selected.");
      return api.delete(`/blogs/${activeBlog.id}/members/${memberId}`);
    },
    onSuccess: (_response, memberId) => {
      const removedMember = members.find((m) => m.id === memberId);
      const targetUserId = removedMember?.user_id;

      // Invalidate both the active team list and the target user's details
      queryClient.invalidateQueries({ queryKey: ['blogMembers', activeBlog?.id] });
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: ['user-detail', targetUserId] });
      }

      toast.success('Member removed from workspace.');
    },
    onError: () => {
      toast.error('Failed to remove member.');
    },
  });

  // 4. Simple local search filtering
  const filteredMembers = members.filter((member) => {
    const searchString = `${member.user.first_name} ${member.user.last_name} ${member.user.username} ${member.user.email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  return {
    currentUser,
    activeBlog,
    queryClient,
    searchTerm,
    setSearchTerm,
    showInviteModal,
    setShowInviteModal,
    filteredMembers,
    pendingInvitations,
    revokeInvitationMutation,
    isOwner,
    isLoading,
    updateRoleMutation,
    removeMutation,
  };
};