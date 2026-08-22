import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Clock, LifeBuoy } from 'lucide-react';
import api from '../../../shared/api/client';
import { TicketListSkeleton } from '../../../shared/ui/Skeleton';
import { useAuth } from '../../auth/context/AuthContext';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface SupportMessage {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
}

interface SupportTicket {
  id: number;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  resolved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const MyTicketsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['my-support-tickets'],
    queryFn: async () => (await api.get('/support/')).data,
    refetchInterval: 8000,
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: number; body: string }) =>
      api.post(`/support/${ticketId}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send reply');
    },
  });

  const selectedTicket = tickets?.find((t) => t.id === selectedTicketId) ?? null;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    await replyMutation.mutateAsync({ ticketId: selectedTicket.id, body: replyBody.trim() });
    setReplyBody('');
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)]">
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <LifeBuoy size={16} className="text-violet-600" />
            My Tickets
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#444444] [&::-webkit-scrollbar-thumb]:rounded-full">
          {isLoading && <TicketListSkeleton />}
          {!isLoading && tickets?.length === 0 && (
            <div className="p-4 text-xs text-zinc-400">
              You haven't submitted any support tickets yet.
            </div>
          )}
          {tickets?.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 transition-colors ${
                selectedTicketId === ticket.id
                  ? 'bg-violet-50 dark:bg-violet-950/20'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {ticket.subject}
                </span>
                <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[ticket.status]}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                <Clock size={11} />
                {formatDate(ticket.updated_at)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden">
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-2">
            <MessageSquare size={28} />
            <p className="text-sm">Select a ticket to view the conversation</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedTicket.subject}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Opened {formatDate(selectedTicket.created_at)}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-track-transparent [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#444444] [&::-webkit-scrollbar-thumb]:rounded-full">
              {selectedTicket.messages.map((message) => {
                const isMine = message.sender_id === user?.id;
                return (
                  <div key={message.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="mb-1 text-[11px] font-medium text-zinc-400">
                      {isMine ? 'You' : 'Support'}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-xl p-3 ${
                        isMine
                          ? 'bg-violet-600 text-white'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400">{formatDate(message.created_at)}</p>
                  </div>
                );
              })}
            </div>

            {selectedTicket.status !== 'closed' ? (
              <form onSubmit={handleReply} className="flex items-end gap-2 p-4 border-t border-zinc-100 dark:border-zinc-800">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={2}
                  placeholder="Write a reply…"
                  className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={replyMutation.isPending || !replyBody.trim()}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white p-2.5 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs text-zinc-400">
                This ticket is closed.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};