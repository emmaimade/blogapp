import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.post(`${API_URL}/auth/forgot-password`, {
        email: email.trim(),
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to send the recovery email right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl shadow-zinc-200/80 border border-zinc-100 p-8 md:p-10 transition-all">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 mb-2">
          Forgot your password?
        </h1>
        <p className="text-sm text-zinc-500">
          Enter the email linked to your account and we’ll send you a secure recovery link.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
          {error}
        </div>
      )}

      {isSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={36} />
          <h2 className="text-lg font-semibold text-zinc-900">Check your inbox</h2>
          <p className="mt-2 text-sm text-zinc-600">
            If the email is registered, a password reset link has been sent to your inbox.
          </p>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isLoading}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Sending...
              </>
            ) : (
              'Resend email'
            )}
          </button>
          <Link
            to="/admin/login"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-5 py-3 pl-12 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-semibold py-3 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-purple-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Sending link...
              </>
            ) : (
              'Send recovery link'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link to="/admin/login" className="text-sm font-semibold text-zinc-500 hover:text-violet-600 transition-colors">
          Return to sign in
        </Link>
      </div>
    </div>
  );
};
