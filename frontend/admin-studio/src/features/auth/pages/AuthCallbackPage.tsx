import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      navigate('/admin/login', { replace: true });
      return;
    }

    localStorage.setItem('token', token);
    const next = searchParams.get('next') || '/admin/dashboard';

    // If there's a pending invite token, auto-accept it now
    const inviteToken = searchParams.get('invite') || sessionStorage.getItem('pending_invite_token');
    if (inviteToken) {
      sessionStorage.removeItem('pending_invite_token');
      axios
        .post(
          `${API_URL}/invitations/${inviteToken}/accept`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .catch(() => {
          // Silently ignore — user might already be a member or invite expired
        })
        .finally(() => {
          navigate(next, { replace: true });
        });
    } else {
      navigate(next, { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        <p className="text-zinc-600 dark:text-zinc-400 font-medium">Setting up your workspace...</p>
      </div>
    </div>
  );
};
