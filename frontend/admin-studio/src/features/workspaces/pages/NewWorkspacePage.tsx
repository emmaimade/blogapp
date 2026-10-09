import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Info, Loader2, X } from 'lucide-react';
import api from '../../../shared/api/client';
import { apiErrorMessage } from '../../../shared/lib/apiErrors';
import { workspacePath } from '../../../shared/lib/workspacePaths';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-violet-500';

// Same rule the backend applies (python-slugify): lowercase letters,
// digits and single hyphens.
const toAddress = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export const NewWorkspacePage = () => {
  useDocumentTitle('New workspace');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { activeBlog } = useBlog();
  const backToWorkspace = useWorkspacePath();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  // Once the address is edited by hand, the name stops rewriting it.
  const [addressEdited, setAddressEdited] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!addressEdited) setAddress(toAddress(value));
  };

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAvailability('checking');
      try {
        const res = await api.get('/auth/check-slug', { params: { slug: address } });
        if (!cancelled) setAvailability(res.data.available ? 'available' : 'taken');
      } catch {
        if (!cancelled) setAvailability('error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address]);

  const shownAvailability: Availability = address ? availability : 'idle';
  const canSubmit = !!name.trim() && !!address && shownAvailability === 'available' && !isCreating;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsCreating(true);
    setError('');
    try {
      const res = await api.post('/blogs/', { name: name.trim(), slug: address });
      // The new membership has to be in the signed-in user before its URL resolves.
      await refreshUser();
      navigate(workspacePath(res.data.slug, '/onboarding'));
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'SLUG_ALREADY_EXISTS') setAvailability('taken');
      setError(apiErrorMessage(err) ?? "We couldn't create the workspace. Please try again.");
      setIsCreating(false);
    }
  };

  const cancelPath = activeBlog ? backToWorkspace() : '/admin';

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <button
        type="button"
        onClick={() => navigate(cancelPath)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="admin-card overflow-hidden rounded-[1.5rem] p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Create a new workspace</h1>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          A workspace is a separate blog with its own posts, team and settings.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="workspace-name" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-300">
              Workspace name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Engineering Blog"
              maxLength={80}
              autoFocus
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="workspace-address" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-300">
              Address
            </label>
            <div className="relative">
              <input
                id="workspace-address"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddressEdited(true);
                  setAddress(toAddress(e.target.value));
                }}
                placeholder="acme-engineering"
                maxLength={63}
                className={`${inputClass} pr-28`}
                aria-describedby="workspace-address-status"
              />
              <div className="pointer-events-none absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-xs font-semibold text-zinc-400">
                <span>.inko.blog</span>
                {shownAvailability === 'checking' && <Loader2 className="animate-spin" size={12} />}
                {shownAvailability === 'available' && <Check size={14} className="text-emerald-500" />}
                {shownAvailability === 'taken' && <X size={14} className="text-red-500" />}
              </div>
            </div>
            <p id="workspace-address-status" className="min-h-[1rem] pl-1 text-xs font-medium">
              {shownAvailability === 'taken' && <span className="text-red-500">That address is already taken.</span>}
              {shownAvailability === 'error' && (
                <span className="text-red-500">We couldn't check this address. Try again in a moment.</span>
              )}
              {shownAvailability === 'available' && (
                <span className="text-emerald-600 dark:text-emerald-400">{address}.inko.blog is available.</span>
              )}
            </p>
          </div>

          <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3.5 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <p>Each workspace has its own plan and billing. New workspaces start on the Free plan.</p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate(cancelPath)}
              className="admin-btn admin-btn-secondary px-5 py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating && <Loader2 className="animate-spin" size={16} />}
              {isCreating ? 'Creating…' : 'Create workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
