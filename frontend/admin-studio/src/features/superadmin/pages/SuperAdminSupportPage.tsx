import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Clock } from 'lucide-react';
import { useSupportTickets, type TicketStatus } from '../hooks/useSupportTickets';
import { ReplyComposer } from '../../support/components/ReplyComposer';
import { TicketListSkeleton } from '../../../shared/ui/Skeleton';
import { useAuth } from '../../auth/context/AuthContext';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const STATUS_TABS: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  resolved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Below md an open thread fills the screen under the 56px (top-14) mobile
// topbar, covering the breadcrumbs, so only its messages scroll and the
// reply box stays pinned. From md up it's the usual side-by-side panel.
const CHAT_SCREEN_OPEN = 'fixed inset-x-0 top-14 bottom-0 z-40 flex md:static md:z-auto';

export const SuperAdminSupportPage = () => {
  useDocumentTitle('Support');
  const { user } = useAuth();
  const {
    tickets,
    isLoading,
    statusFilter,
    setStatusFilter,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    updateStatusMutation,
    replyMutation,
  } = useSupportTickets();

  const [replyBody, setReplyBody] = useState('');

  // Notification links point here as ?ticket=<id>. Clear the status filter
  // too, otherwise the linked ticket could be hidden by the active tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedTicketId = Number(searchParams.get('ticket')) || null;
  useEffect(() => {
    if (linkedTicketId) {
      setStatusFilter('all');
      setSelectedTicketId(linkedTicketId);
    }
  }, [linkedTicketId, setStatusFilter, setSelectedTicketId]);

  // Phones show either the list or the open thread, never both. Going back
  // also drops ?ticket, so tapping the same notification again reopens it.
  const closeThread = () => {
    setSelectedTicketId(null);
    if (linkedTicketId) setSearchParams({}, { replace: true });
  };

  // Open on the newest message, and follow new replies as they arrive.
  const messagesRef = useRef<HTMLDivElement>(null);
  const messageCount = selectedTicket?.messages.length;
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedTicketId, messageCount]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    await replyMutation.mutateAsync({ ticketId: selectedTicket.id, body: replyBody.trim() });
    setReplyBody('');
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-auto md:h-[calc(100vh-180px)]">
      {/* Ticket list */}
      <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 flex-col border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden`}>
        <div className="flex gap-1 p-2 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#444444] [&::-webkit-scrollbar-thumb]:rounded-full">
          {isLoading && <TicketListSkeleton />}
          {!isLoading && tickets?.length === 0 && (
            <div className="p-4 text-xs text-zinc-400">No tickets in this view.</div>
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
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[ticket.status]}`}>
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

      {/* Thread view */}
      <div className={`${selectedTicket ? CHAT_SCREEN_OPEN : 'hidden md:flex'} flex-1 flex-col md:border border-zinc-200 dark:border-zinc-800 md:rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden`}>
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-2">
            <MessageSquare size={28} />
            <p className="text-sm">Select a ticket to view the conversation</p>
          </div>
        ) : (
          <>
            <button
              onClick={closeThread}
              className="md:hidden flex items-center gap-1.5 px-5 pt-3 text-xs font-medium text-violet-600"
            >
              <ArrowLeft size={14} /> Back to tickets
            </button>
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedTicket.subject}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Opened {formatDate(selectedTicket.created_at)}
                  {selectedTicket.blog_id && ` · ${selectedTicket.blog_name ?? 'Deleted workspace'}`}
                </p>
              </div>
              <select
                value={selectedTicket.status}
                onChange={(e) =>
                  updateStatusMutation.mutate({ ticketId: selectedTicket.id, status: e.target.value as TicketStatus })
                }
                className="text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div ref={messagesRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 scrollbar-thin scrollbar-track-transparent [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#444444] [&::-webkit-scrollbar-thumb]:rounded-full">
              {selectedTicket.messages.map((message) => {
                const isCustomer = message.sender_id === selectedTicket.user_id;
                const isMine = message.sender_id === user?.id;
                return (
                  <div key={message.id} className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}>
                    <span className="mb-1 text-[11px] font-medium text-zinc-400">
                      {isCustomer ? selectedTicket.user_name ?? 'Customer' : isMine ? 'You' : 'Support'}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-xl p-3 ${
                        isCustomer
                          ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                          : 'bg-violet-600 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400">{formatDate(message.created_at)}</p>
                  </div>
                );
              })}
            </div>

            {selectedTicket.status !== 'closed' && (
              <ReplyComposer
                value={replyBody}
                onChange={setReplyBody}
                onSubmit={handleReply}
                isSending={replyMutation.isPending}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};