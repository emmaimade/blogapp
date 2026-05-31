import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { InkoLogo } from '../shared/inko';
import { Clock, Loader2, AlertCircle, LogIn, UserPlus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ADMIN_STUDIO_URL = import.meta.env.VITE_ADMIN_STUDIO_URL || 'http://localhost:5173';

interface InviteInfo {
  blog_name: string;
  blog_slug: string;
  role: string;
  expires_at: string;
  already_accepted: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  editor: 'bg-violet-100 text-violet-800',
  author: 'bg-blue-100 text-blue-800',
};

export const JoinPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'expired'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await axios.get(`${API_URL}/invitations/${token}`);
        setInfo(res.data);
        setStatus(res.data.already_accepted ? 'error' : 'ready');
        if (res.data.already_accepted) setErrorMsg('This invite link has already been used.');
      } catch (err: any) {
        if (err.response?.status === 410) {
          setStatus('expired');
        } else {
          setStatus('error');
          setErrorMsg(err.response?.data?.detail || 'This invite link is invalid or has been revoked.');
        }
      }
    };
    fetchInvite();
  }, [token]);

  // Store invite token in sessionStorage so signup/login pages can pick it up
  const storeAndRedirect = (path: 'login' | 'signup') => {
    sessionStorage.setItem('pending_invite_token', token!);
    if (path === 'login') {
      window.location.href = `${ADMIN_STUDIO_URL}/admin/login?invite=${token}`;
    } else {
      navigate(`/signup?invite=${token}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <Link to="/" className="mb-10 flex items-center gap-2">
        <InkoLogo size={24} />
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">INKO</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="animate-spin text-violet-500" size={32} />
            <p className="text-sm text-zinc-500">Loading invite...</p>
          </div>
        )}

        {status === 'expired' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Clock className="text-amber-600" size={24} />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Link expired</h2>
            <p className="text-sm text-zinc-500">This invite link has expired. Ask your workspace owner to generate a new one.</p>
            <Link to="/" className="mt-2 text-sm font-semibold text-violet-600 hover:underline">Back to home</Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="text-red-600" size={24} />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Invalid invite</h2>
            <p className="text-sm text-zinc-500">{errorMsg}</p>
            <Link to="/" className="mt-2 text-sm font-semibold text-violet-600 hover:underline">Back to home</Link>
          </div>
        )}

        {status === 'ready' && info && (
          <>
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-2xl font-bold text-white">
                {info.blog_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  You're invited to join
                </h2>
                <p className="mt-0.5 text-xl font-black text-zinc-900 dark:text-white">{info.blog_name}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ROLE_COLORS[info.role] ?? 'bg-zinc-100 text-zinc-700'}`}>
                as <strong className="capitalize">{info.role}</strong>
              </span>
              <p className="text-xs text-zinc-400">
                Expires {new Date(info.expires_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => storeAndRedirect('login')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                <LogIn size={16} />
                Sign in to accept
              </button>
              <button
                onClick={() => storeAndRedirect('signup')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <UserPlus size={16} />
                Create an account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
