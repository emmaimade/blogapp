import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { useStoredTheme } from '../../../shared/lib/theme';

interface WorkspaceStateScreenProps {
  kind: 'not-found' | 'none';
  /** Where "Go to my workspace" leads; omitted when the user has none. */
  fallbackPath?: string;
}

const COPY = {
  'not-found': {
    eyebrow: 'Workspace not found',
    title: "This workspace isn't available",
    // Deliberately the same whether it doesn't exist or you aren't a member,
    // so a guessed address can't confirm a private workspace exists.
    body: "The link may be wrong, or you don't have access to it. If someone shared this link, ask them to invite you.",
  },
  none: {
    eyebrow: 'No workspace yet',
    title: "You're not in any workspace yet",
    body: 'Accept an invitation from your email to join a team, or sign up to start your own blog.',
  },
} as const;

export const WorkspaceStateScreen = ({ kind, fallbackPath }: WorkspaceStateScreenProps) => {
  const { user, logout } = useAuth();
  const copy = COPY[kind];
  useStoredTheme();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--admin-bg)] px-4">
      <div className="admin-card w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 inline-flex rounded-full bg-violet-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          {copy.eyebrow}
        </div>
        <h2 className="mb-3 text-3xl font-bold text-zinc-900 dark:text-white">{copy.title}</h2>
        <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{copy.body}</p>
        {user && (
          <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
            Signed in as <span className="font-semibold">{user.email}</span>
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {fallbackPath && (
            <Link to={fallbackPath} replace className="admin-btn admin-btn-primary px-6 py-3 text-sm">
              Go to my workspace
            </Link>
          )}
          <button
            onClick={() => {
              logout();
              window.location.href = '/admin/login';
            }}
            className="admin-btn admin-btn-secondary px-6 py-3 text-sm"
          >
            Sign in as someone else
          </button>
        </div>
      </div>
    </div>
  );
};
