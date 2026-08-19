import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportMessage {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  user_id: number;
  blog_id: number | null;
  blog_name: string | null;
  user_name: string | null;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
}

export const useSupportTickets = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['superadmin-support-tickets', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { ticket_status: statusFilter } : {};
      return (await api.get('/superadmin/support', { params })).data;
    },
    refetchInterval: 8000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: TicketStatus }) =>
      api.patch(`/superadmin/support/${ticketId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] });
      toast.success('Ticket status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: number; body: string }) =>
      api.post(`/support/${ticketId}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send reply');
    },
  });

  const selectedTicket = tickets?.find((t) => t.id === selectedTicketId) ?? null;

  return {
    tickets,
    isLoading,
    statusFilter,
    setStatusFilter,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    updateStatusMutation,
    replyMutation,
  };
};