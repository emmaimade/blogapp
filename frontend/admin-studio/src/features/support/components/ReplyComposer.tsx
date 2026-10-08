import { useState } from 'react';
import { Send } from 'lucide-react';

interface ReplyComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSending: boolean;
}

// Reply box for a support ticket thread. With a physical keyboard (a fine
// pointer - mouse or trackpad) Enter sends and Shift+Enter adds a line, like
// most chat apps. On touchscreens Enter stays a newline and the send button
// sends, since the on-screen Enter key is easy to hit mid-message.
export const ReplyComposer = ({ value, onChange, onSubmit, isSending }: ReplyComposerProps) => {
  const [sendsOnEnter] = useState(() => window.matchMedia('(pointer: fine)').matches);
  const canSend = !!value.trim() && !isSending;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!sendsOnEnter || e.key !== 'Enter' || e.shiftKey) return;
    // Let an IME composition (e.g. picking CJK characters) finish first.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (canSend) e.currentTarget.form?.requestSubmit();
  };

  return (
    <form onSubmit={onSubmit} className="p-4 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Write a reply…"
          className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none text-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send reply"
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white p-2.5 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
      {sendsOnEnter && (
        <p className="mt-1.5 text-[11px] text-zinc-400">Enter to send · Shift+Enter for a new line</p>
      )}
    </form>
  );
};
