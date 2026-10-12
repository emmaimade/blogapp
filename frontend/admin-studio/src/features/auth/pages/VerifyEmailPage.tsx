import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { InkoLogo } from '../../../assets/inko';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiErrorMessage } from '../../../shared/lib/apiErrors';
import { useAuth } from '../context/AuthContext';
import { getPostLoginPath, needsEmailVerification } from '../lib/accessControl';

const CODE_LENGTH = 6;
// Matches the backend's resend cooldown; a 429 carries the exact remainder.
const RESEND_COOLDOWN_SECONDS = 60;

const retryAfterSeconds = (error: unknown): number | undefined => {
  const response = (error as { response?: { status?: number; headers?: Record<string, string> } })?.response;
  if (response?.status !== 429) return undefined;
  const seconds = Number(response.headers?.['retry-after']);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : RESEND_COOLDOWN_SECONDS;
};

/**
 * The step between signup and the studio: enter the 6-digit code from the
 * verification email. The same email's link works too (on the public site);
 * either way, nothing behind ProtectedRoute opens until this is done.
 */
export const VerifyEmailPage = () => {
  useDocumentTitle('Verify your email');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser, logout } = useAuth();

  const codeSent = (location.state as { codeSent?: boolean } | null)?.codeSent === true;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  // Signup has just sent a code, so resending waits out the cooldown.
  const [cooldown, setCooldown] = useState(codeSent ? RESEND_COOLDOWN_SECONDS : 0);
  const [sending, setSending] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!user) return null;
  // Verified (here, or via the link in another tab): carry on to the studio.
  if (!needsEmailVerification(user)) return <Navigate to={getPostLoginPath(user)} replace />;

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH || verifying) return;
    setVerifying(true);
    setError('');
    try {
      await api.post('/auth/verify-email-code', { code: value });
      toast.success('Email verified.');
      // The refreshed user is verified, so the guard above moves on.
      await refreshUser();
    } catch (err) {
      setError(apiErrorMessage(err) ?? "We couldn't check that code. Please try again.");
      // Leave the digits in place but selected, so one typo is one retype.
      requestAnimationFrame(() => codeInputRef.current?.select());
    } finally {
      setVerifying(false);
    }
  };

  const onCodeChange = (raw: string) => {
    // Accept pasted "123 456" / "123-456" and autofill alike.
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  const resend = async () => {
    if (cooldown > 0 || sending) return;
    setSending(true);
    setError('');
    try {
      await api.post('/auth/send-verification', { email: user.email });
      toast.success(`New code sent to ${user.email}.`);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      codeInputRef.current?.focus();
    } catch (err) {
      const retry = retryAfterSeconds(err);
      if (retry) {
        // The last code is still fresh — say so, rather than just restarting the timer.
        setCooldown(retry);
        toast(`We just sent you a code. You can request another in ${retry}s.`);
      } else {
        setError(apiErrorMessage(err) ?? "We couldn't send a new code. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    setSavingEmail(true);
    setEmailError('');
    try {
      await api.put('/auth/email', { email: newEmail.trim() });
      await refreshUser();
      toast.success('Email updated — we sent a new code.');
      setEditingEmail(false);
      setCode('');
      setError('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const retry = retryAfterSeconds(err);
      if (retry) setCooldown(retry);
      setEmailError(apiErrorMessage(err) ?? "We couldn't update your email. Please try again.");
    } finally {
      setSavingEmail(false);
    }
  };

  const switchAccount = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <InkoLogo size={28} />
          <span className="text-xl font-black text-zinc-900 dark:text-white">Inko</span>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck size={22} />
          </div>
          <h1 className="text-center text-2xl font-black text-zinc-900 dark:text-white">Check your email</h1>
          <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            We sent a {CODE_LENGTH}-digit code to{' '}
            <strong className="font-semibold text-zinc-900 dark:text-white break-all">{user.email}</strong>.
            Enter it below to continue.
          </p>

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void verify(code);
            }}
          >
            <label htmlFor="verify-code" className="sr-only">Verification code</label>
            <input
              id="verify-code"
              ref={codeInputRef}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={CODE_LENGTH + 2}
              placeholder="000000"
              aria-invalid={!!error}
              aria-describedby={error ? 'verify-code-error' : undefined}
              disabled={verifying}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.5em] text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none transition focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${
                error ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-primary'
              }`}
            />
            {error && (
              <p id="verify-code-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={code.length !== CODE_LENGTH || verifying}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {verifying ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : 'Verify email'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              Didn't get it? Check your spam folder, or{' '}
              {cooldown > 0 ? (
                <span>resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={resend}
                  disabled={sending}
                  className="font-semibold text-primary hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {sending ? 'sending…' : 'send a new code'}
                </button>
              )}
              .
            </p>

            {!editingEmail ? (
              <p>
                Wrong email?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setNewEmail(user.email);
                    setEmailError('');
                    setEditingEmail(true);
                  }}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Change it
                </button>
              </p>
            ) : (
              <form onSubmit={saveEmail} className="mt-3 text-left">
                <label htmlFor="verify-new-email" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Your email address
                </label>
                <input
                  id="verify-new-email"
                  type="email"
                  required
                  autoFocus
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  aria-invalid={!!emailError}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                {emailError && (
                  <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{emailError}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={savingEmail || cooldown > 0 || !newEmail.trim() || newEmail.trim() === user.email}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingEmail && <Loader2 size={13} className="animate-spin" />}
                    {/* Every send shares the resend cooldown, a new address included. */}
                    {cooldown > 0 ? `Send code in ${cooldown}s` : 'Send code to this address'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingEmail(false)}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Not you?{' '}
          <button type="button" onClick={switchAccount} className="font-semibold hover:underline cursor-pointer">
            Sign in with a different account
          </button>
        </p>
      </div>
    </div>
  );
};
