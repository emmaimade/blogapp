// features/support/components/SupportModal.tsx
import { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, LifeBuoy, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

export const SupportModal = ({ open, onClose }: SupportModalProps) => {
  const { activeBlog } = useBlog();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!subject.trim() || !body.trim()) {
      toast.error('Please fill in both a subject and a message.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/support/', {
        subject: subject.trim(),
        body: body.trim(),
        blog_id: activeBlog?.id ?? null,
      });
      toast.success("Ticket submitted — we'll get back to you soon.");
      setSubject('');
      setBody('');
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not submit your ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <LifeBuoy size={18} className="text-violet-600" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Contact Support</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Briefly describe the issue"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Tell us what's going on..."
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 text-zinc-900 dark:text-zinc-100 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={14} />
            {isSubmitting ? 'Sending...' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
};