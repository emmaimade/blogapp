import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../../shared/api/client";
import { useAuth } from "../../auth/context/AuthContext";
import { useBlog } from "../../../app/providers/BlogProvider";

export type BlogRole = "owner" | "editor" | "author";

export interface BlogMember {
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

export const useUserManager = () => {
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
    mutationFn: ({ memberId, newRole }: { memberId: number; newRole: BlogRole }) =>
      api.patch(`/members/${memberId}`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogMembers", activeBlog?.id] });
      toast.success("Role updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update role");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => api.delete(`/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogMembers", activeBlog?.id] });
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

  return {
    currentUser,
    activeBlog,
    queryClient,
    searchTerm,
    setSearchTerm,
    showInviteModal,
    setShowInviteModal,
    removingId,
    setRemovingId,
    filteredMembers,
    isOwner,
    isLoading,
    updateRoleMutation,
    removeMutation,
  };
};