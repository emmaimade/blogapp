import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../shared/api/client';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

// Not currently reachable from any backend flow (no email template or invite
// endpoint redirects here) — kept for a future magic-link/OAuth-style flow.
// If that's ever wired up, the backend redirect must set the session cookies
// itself rather than passing tokens in this page's URL, which is its own
// leak vector (browser history, referrer, server logs).
export const AuthCallbackPage = () => {
  useDocumentTitle('Signing in…');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const next = searchParams.get('next') || '/admin';

    const inviteToken = searchParams.get('invite') || sessionStorage.getItem('pending_invite_token');
    if (inviteToken) {
      sessionStorage.removeItem('pending_invite_token');
      api
        .post(`/invitations/${inviteToken}/accept`, {})
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
