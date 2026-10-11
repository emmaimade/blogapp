import { useState } from 'react';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useAuth } from '../context/AuthContext';

const useResendVerification = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!user) return;
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

  return { resend, sending };
};

/**
 * Strip under the onboarding header. Not dismissible: launching needs a
 * verified email, so hiding the reminder only moves the surprise to the end.
 */
export const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const { resend, sending } = useResendVerification();

  if (!user || user.email_verified) return null;

  return (
    <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 sm:px-6 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
      <div className="flex items-center gap-2">
        <Mail size={16} className="flex-shrink-0" />
        <span>Verify your email before launching your blog — check your inbox for the link.</span>
      </div>
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="font-semibold underline hover:no-underline disabled:opacity-50 cursor-pointer"
      >
        {sending ? 'Sending…' : 'Resend email'}
      </button>
    </div>
  );
};

/**
 * Shown where launching happens, so an unverified owner can sort it out
 * without leaving the page: resend the link, or re-check after clicking it.
 */
export const EmailVerificationCard = () => {
  const { user, refreshUser } = useAuth();
  const { resend, sending } = useResendVerification();
  const [checking, setChecking] = useState(false);

  if (!user || user.email_verified) return null;

  const checkAgain = async () => {
    setChecking(true);
    try {
      const fresh = await refreshUser();
      if (!fresh?.email_verified) {
        toast.error("We haven't seen the verification yet. Open the link in the email, then check again.");
      }
    } catch {
      toast.error('Could not check your verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
      <div className="flex items-start gap-3">
        <Mail size={18} className="mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Verify your email to launch</p>
          <p className="mt-1 text-xs">
            We sent a link to <strong>{user.email}</strong>. Click it, then come back and check again.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkAgain}
              disabled={checking}
              className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
            >
              {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              I've verified — check again
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={sending}
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 cursor-pointer dark:border-amber-800 dark:hover:bg-amber-900/30"
            >
              {sending ? 'Sending…' : 'Resend email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
