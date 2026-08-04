import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useAuth } from '../context/AuthContext';

export const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/send-verification', { email: user.email });
      toast.success('Verification email sent — check your inbox.');
    } catch {
      toast.error('Could not resend verification email. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
      <div className="flex items-center gap-2">
        <Mail size={16} className="flex-shrink-0" />
        <span>Verify your email to unlock publishing — check your inbox for the link.</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={resend} disabled={sending} className="font-semibold underline hover:no-underline disabled:opacity-50">
          {sending ? 'Sending…' : 'Resend'}
        </button>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};