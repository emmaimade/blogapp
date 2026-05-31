import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, ArrowLeft, Check, Loader2, Mail,
  Rocket, ShieldCheck, Sparkles, Users, Lock,
  CheckCircle2, Globe, FileText, BarChart3, Building2,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useAuth } from '../../auth/context/AuthContext';
import { InkoLogo } from '../../../assets/inko';

type SubscriptionPlan = 'free' | 'pro' | 'team';
type OnboardingStepKey = 'about' | 'profile' | 'publication' | 'team' | 'plan';

interface OnboardingState {
  blog: {
    id: number;
    name: string;
    description?: string | null;
    onboarding_status: 'not_started' | 'in_progress' | 'completed';
    onboarding_step: OnboardingStepKey;
    owner_role?: string | null;
    workspace_type?: string | null;
    team_size?: string | null;
    category?: string | null;
    primary_language: string;
    tagline?: string | null;
    logo_url?: string | null;
    favicon_url?: string | null;
    default_post_visibility: 'public' | 'members_only' | 'paid_only';
    comments_enabled: boolean;
    posts_per_page: number;
    timezone: string;
  };
  subscription?: { plan: SubscriptionPlan; status: string } | null;
  summary: {
    current_step: OnboardingStepKey;
    completed_steps: number;
    total_steps: number;
    percent_complete: number;
    checklist: Record<OnboardingStepKey, boolean>;
  };
}

const STEP_ORDER: OnboardingStepKey[] = ['about', 'profile', 'publication', 'team', 'plan'];

const STEP_META: Record<OnboardingStepKey, { label: string; hint: string; optional?: boolean }> = {
  about:       { label: 'About you',        hint: 'Your role and what you\'re building' },
  profile:     { label: 'Blog profile',      hint: 'Name, tagline, and category' },
  publication: { label: 'Publishing',        hint: 'Visibility, comments, and timezone' },
  team:        { label: 'Invite team',       hint: 'Add collaborators', optional: true },
  plan:        { label: 'Choose plan',       hint: 'Free trial or paid' },
};

const inputClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-violet-500';

const selectClass = inputClass;

// ─── Shared field wrapper ───────────────────────────────────────────────────
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</label>
    {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    {children}
  </div>
);

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeBlog, requiresOnboarding } = useBlog();
  const { refreshUser } = useAuth();

  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>('about');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'author'>('editor');
  const [showOptionalProfile, setShowOptionalProfile] = useState(false);
  const [done, setDone] = useState(false);

  // Tracks whether we've done the first data sync from the server.
  // After that, currentStep is driven locally so saves don't reset the step.
  const hasInitialized = useRef(false);

  const [aboutForm, setAboutForm] = useState({
    owner_role: 'blogger',
    workspace_type: 'personal_blog',
    team_size: 'solo',
  });
  const [profileForm, setProfileForm] = useState({
    name: '',
    tagline: '',
    description: '',
    category: 'Tech',
    primary_language: 'en',
    logo_url: '',
    favicon_url: '',
  });
  const [publicationForm, setPublicationForm] = useState({
    default_post_visibility: 'public',
    comments_enabled: true,
    posts_per_page: 10,
    timezone: 'UTC',
  });
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('free');

  const onboardingQuery = useQuery<OnboardingState>({
    queryKey: ['onboarding', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog?.id}/onboarding`)).data,
    enabled: !!activeBlog,
  });

  useEffect(() => {
    if (!onboardingQuery.data) return;
    const { blog, subscription, summary } = onboardingQuery.data;

    // Always sync form field values so saved data populates correctly on refresh
    setAboutForm({ owner_role: blog.owner_role ?? 'blogger', workspace_type: blog.workspace_type ?? 'personal_blog', team_size: blog.team_size ?? 'solo' });
    setProfileForm({ name: blog.name ?? '', tagline: blog.tagline ?? '', description: blog.description ?? '', category: blog.category ?? 'Tech', primary_language: blog.primary_language ?? 'en', logo_url: blog.logo_url ?? '', favicon_url: blog.favicon_url ?? '' });
    setPublicationForm({ default_post_visibility: blog.default_post_visibility ?? 'public', comments_enabled: blog.comments_enabled, posts_per_page: blog.posts_per_page ?? 10, timezone: blog.timezone ?? 'UTC' });
    setSelectedPlan(subscription?.plan ?? 'free');

    // Only set currentStep on the very first load.
    // After that, step navigation is driven locally — syncing from the server
    // after every save would race with setCurrentStep('next-step') in onSuccess
    // and reset the user back to the step they just completed.
    if (!hasInitialized.current) {
      setCurrentStep(summary.current_step);
      hasInitialized.current = true;
    }
  }, [onboardingQuery.data]);

  useEffect(() => {
    if (activeBlog && !requiresOnboarding) navigate('/admin/dashboard', { replace: true });
  }, [activeBlog, navigate, requiresOnboarding]);

  const syncAfterSave = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['onboarding', activeBlog?.id] }),
      refreshUser(),
    ]);
  };

  const saveAbout = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/about`, aboutForm),
    onSuccess: async () => {
      setCurrentStep('profile');
      toast.success('Saved.');
      await syncAfterSave();
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/profile`, profileForm),
    onSuccess: async () => {
      setCurrentStep('publication');
      toast.success('Saved.');
      await syncAfterSave();
    },
  });

  const savePublication = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/publication`, publicationForm),
    onSuccess: async () => {
      setCurrentStep('team');
      toast.success('Saved.');
      await syncAfterSave();
    },
  });

  const completeTeam = useMutation({
    mutationFn: async (skipped: boolean) => api.post(`/blogs/${activeBlog?.id}/onboarding/team/complete`, { skipped }),
    onSuccess: async () => {
      setCurrentStep('plan');
      await syncAfterSave();
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/plan`, { plan: selectedPlan }),
    onSuccess: async () => {
      setDone(true);
      await syncAfterSave();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => api.post('/members', { email: inviteEmail, role: inviteRole }),
    onSuccess: async () => {
      setInviteEmail('');
      toast.success('Invite sent.');
      await syncAfterSave();
    },
  });

  const progress = onboardingQuery.data?.summary;
  const completedMap = progress?.checklist ?? { about: false, profile: false, publication: false, team: false, plan: false };
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const goBack = () => {
    if (currentIndex > 0) setCurrentStep(STEP_ORDER[currentIndex - 1]);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (!activeBlog || onboardingQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-primary" size={28} />
          <p className="text-sm text-zinc-500">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (onboardingQuery.isError || !onboardingQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-10 text-center max-w-sm w-full">
          <ShieldCheck className="mx-auto mb-4 text-red-500" size={28} />
          <h2 className="font-bold text-zinc-900 dark:text-white mb-2">Could not load onboarding</h2>
          <button onClick={() => onboardingQuery.refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Completion screen ────────────────────────────────────────────────────
  if (done) {
    const liveUrl = activeBlog.custom_domain
      ? `https://${activeBlog.custom_domain}`
      : `https://${activeBlog.subdomain}.inko.blog`;
    const displayUrl = activeBlog.custom_domain ?? `${activeBlog.subdomain}.inko.blog`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-10 text-center max-w-md w-full">

          {/* Success icon */}
          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-green-500" size={32} />
          </div>

          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">
            {activeBlog.name} is live
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Your workspace is fully unlocked. Your blog is live at the address below.
          </p>

          {/* Live URL — the payoff moment */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 flex items-center gap-3 mb-6">
            <Globe size={15} className="text-primary flex-shrink-0" />
            <span className="flex-1 text-sm font-mono font-semibold text-zinc-900 dark:text-white truncate text-left">
              {displayUrl}
            </span>
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-primary"
              title="Visit your blog"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/admin/dashboard', { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-white hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
            >
              Go to dashboard <ArrowRight size={16} />
            </button>
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            >
              Visit your blog <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">

      {/* Top bar — minimal */}
      <header className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <InkoLogo size={16} />
          </div>
          <span className="text-base font-black text-zinc-900 dark:text-white">INKO</span>
          <span className="hidden sm:block text-zinc-300 dark:text-zinc-700">·</span>
          <span className="hidden sm:block text-sm text-zinc-500 dark:text-zinc-400">Workspace setup</span>
        </div>

        {/* Top progress */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {progress?.completed_steps}/{progress?.total_steps} steps
          </span>
          <div className="w-32 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress?.percent_complete ?? 0}%` }}
            />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left stepper rail */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-8 gap-1">
          {STEP_ORDER.map((step, i) => {
            const done = completedMap[step];
            const active = step === currentStep;
            const locked = !done && i > currentIndex && !active;
            const meta = STEP_META[step];
            return (
              <button
                key={step}
                type="button"
                onClick={() => !locked && setCurrentStep(step)}
                disabled={locked}
                className={`flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                  active
                    ? 'bg-accent dark:bg-violet-950/40'
                    : locked
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer'
                }`}
              >
                {/* Step dot */}
                <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : active
                    ? 'bg-primary text-white'
                    : locked
                    ? 'border-2 border-zinc-200 dark:border-zinc-700 text-zinc-400'
                    : 'border-2 border-zinc-300 dark:border-zinc-600 text-zinc-500'
                }`}>
                  {done ? <Check size={12} /> : locked ? <Lock size={10} /> : i + 1}
                </div>

                <div className="min-w-0">
                  <div className={`text-sm font-semibold leading-none ${active ? 'text-primary' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {meta.label}
                    {meta.optional && (
                      <span className="ml-1.5 text-[10px] font-normal text-zinc-400">optional</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 leading-snug">{meta.hint}</div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Main form area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 py-10">

            {/* Step header */}
            <div className="mb-8">
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                Step {currentIndex + 1} of {STEP_ORDER.length}
                {STEP_META[currentStep].optional && (
                  <span className="ml-2 text-zinc-400 normal-case tracking-normal">· optional</span>
                )}
              </div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white">
                {currentStep === 'about'       && 'Tell us about your setup'}
                {currentStep === 'profile'     && 'Set up your blog profile'}
                {currentStep === 'publication' && 'Configure publishing defaults'}
                {currentStep === 'team'        && 'Invite your team'}
                {currentStep === 'plan'        && 'Choose how you want to start'}
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {currentStep === 'about'       && 'This helps us personalise the admin studio for how your team works.'}
                {currentStep === 'profile'     && 'The basics readers will see. You can update these any time in Settings.'}
                {currentStep === 'publication' && 'Set sensible defaults once. Every new post will inherit these.'}
                {currentStep === 'team'        && 'Teammates added now will get an email invite instantly. You can always add more later.'}
                {currentStep === 'plan'        && 'Your trial is already active. Pick a plan now or stay on free and upgrade when ready.'}
              </p>
            </div>

            {/* ── STEP: ABOUT ─────────────────────────────────────── */}
            {currentStep === 'about' && (
              <div className="space-y-5">
                <Field label="Your role">
                  <select className={selectClass} value={aboutForm.owner_role} onChange={(e) => setAboutForm((p) => ({ ...p, owner_role: e.target.value }))}>
                    <option value="blogger">Blogger / Creator</option>
                    <option value="agency">Agency</option>
                    <option value="saas_company">SaaS company</option>
                    <option value="content_team">Content team</option>
                  </select>
                </Field>
                <Field label="What are you building?">
                  <select className={selectClass} value={aboutForm.workspace_type} onChange={(e) => setAboutForm((p) => ({ ...p, workspace_type: e.target.value }))}>
                    <option value="personal_blog">Personal blog</option>
                    <option value="client_blogs">Client blogs</option>
                    <option value="company_blog">Company blog</option>
                    <option value="developer_docs">Developer docs</option>
                  </select>
                </Field>
                <Field label="Team size">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 'solo',    label: 'Just me' },
                      { value: 'small',   label: '2 – 5' },
                      { value: 'growing', label: '6 – 20' },
                      { value: 'large',   label: '20+' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAboutForm((p) => ({ ...p, team_size: value }))}
                        className={`rounded-lg border py-3 text-sm font-semibold transition-all ${
                          aboutForm.team_size === value
                            ? 'border-primary bg-accent text-accent-text dark:bg-violet-950/40 dark:border-violet-500 dark:text-violet-300'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <StepActions
                  onContinue={() => saveAbout.mutate()}
                  loading={saveAbout.isPending}
                  showBack={false}
                />
              </div>
            )}

            {/* ── STEP: PROFILE ──────────────────────────────────── */}
            {currentStep === 'profile' && (
              <div className="space-y-5">
                <Field label="Blog display name">
                  <input
                    className={inputClass}
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="My Awesome Blog"
                  />
                </Field>
                <Field label="Tagline" hint="One sentence that captures what your blog is about.">
                  <input
                    className={inputClass}
                    value={profileForm.tagline}
                    onChange={(e) => setProfileForm((p) => ({ ...p, tagline: e.target.value }))}
                    placeholder="Your ideas, amplified"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Category">
                    <select className={selectClass} value={profileForm.category} onChange={(e) => setProfileForm((p) => ({ ...p, category: e.target.value }))}>
                      {['Tech', 'Business', 'Lifestyle', 'Marketing', 'Education', 'Design', 'Other'].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Primary language">
                    <select className={selectClass} value={profileForm.primary_language} onChange={(e) => setProfileForm((p) => ({ ...p, primary_language: e.target.value }))}>
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="es">Spanish</option>
                      <option value="de">German</option>
                      <option value="pt">Portuguese</option>
                    </select>
                  </Field>
                </div>

                <Field label="Description" hint="Optional — shown on your blog's about page.">
                  <textarea
                    className={`${inputClass} min-h-24 resize-none`}
                    value={profileForm.description}
                    onChange={(e) => setProfileForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="A short paragraph about what you publish…"
                  />
                </Field>

                {/* Optional fields — collapsed by default */}
                {!showOptionalProfile ? (
                  <button
                    type="button"
                    onClick={() => setShowOptionalProfile(true)}
                    className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                  >
                    + Add logo and favicon (optional)
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Logo URL" hint="Optional">
                      <input className={inputClass} value={profileForm.logo_url} onChange={(e) => setProfileForm((p) => ({ ...p, logo_url: e.target.value }))} placeholder="https://…" />
                    </Field>
                    <Field label="Favicon URL" hint="Optional">
                      <input className={inputClass} value={profileForm.favicon_url} onChange={(e) => setProfileForm((p) => ({ ...p, favicon_url: e.target.value }))} placeholder="https://…" />
                    </Field>
                  </div>
                )}

                <StepActions
                  onContinue={() => saveProfile.mutate()}
                  onBack={goBack}
                  loading={saveProfile.isPending}
                  disabled={!profileForm.name || !profileForm.tagline}
                />
              </div>
            )}

            {/* ── STEP: PUBLICATION ──────────────────────────────── */}
            {currentStep === 'publication' && (
              <div className="space-y-5">
                <Field label="Default post visibility" hint="New posts will inherit this setting. Authors can override per post.">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'public',       label: 'Public',       icon: Globe },
                      { value: 'members_only', label: 'Members only', icon: Users },
                      { value: 'paid_only',    label: 'Paid only',    icon: ShieldCheck },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPublicationForm((p) => ({ ...p, default_post_visibility: value as any }))}
                        className={`flex flex-col items-center gap-2 rounded-lg border py-4 text-xs font-semibold transition-all ${
                          publicationForm.default_post_visibility === value
                            ? 'border-primary bg-accent text-accent-text dark:bg-violet-950/40 dark:border-violet-500 dark:text-violet-300'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Timezone">
                    <input className={inputClass} value={publicationForm.timezone} onChange={(e) => setPublicationForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="UTC" />
                  </Field>
                  <Field label="Posts per page">
                    <input type="number" min={1} max={50} className={inputClass} value={publicationForm.posts_per_page} onChange={(e) => setPublicationForm((p) => ({ ...p, posts_per_page: Number(e.target.value) || 1 }))} />
                  </Field>
                </div>

                <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                  publicationForm.comments_enabled
                    ? 'border-primary bg-accent/40 dark:bg-violet-950/30 dark:border-violet-700'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={publicationForm.comments_enabled}
                    onChange={(e) => setPublicationForm((p) => ({ ...p, comments_enabled: e.target.checked }))}
                    className="accent-primary w-4 h-4"
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">Enable comments by default</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Readers can comment on posts. You can moderate in Comments.</div>
                  </div>
                </label>

                <StepActions
                  onContinue={() => savePublication.mutate()}
                  onBack={goBack}
                  loading={savePublication.isPending}
                />
              </div>
            )}

            {/* ── STEP: TEAM ─────────────────────────────────────── */}
            {currentStep === 'team' && (
              <div className="space-y-5">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">Invite a teammate</span>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                      <input
                        className={`${inputClass} pl-10`}
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@company.com"
                      />
                    </div>
                    <div className="flex gap-3">
                      <select className={`${selectClass} flex-1`} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'editor' | 'author')}>
                        <option value="editor">Editor — can manage all content</option>
                        <option value="author">Author — can create and edit own posts</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => inviteMutation.mutate()}
                        disabled={inviteMutation.isPending || !inviteEmail}
                        className="flex-shrink-0 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-3 text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90"
                      >
                        {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role descriptions */}
                <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {[
                    { role: 'Editor', desc: 'Full content access, can invite authors, moderate comments.' },
                    { role: 'Author', desc: 'Creates and publishes own posts. No team or settings access.' },
                  ].map(({ role, desc }) => (
                    <div key={role} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
                      <div className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{role}</div>
                      {desc}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-all"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => completeTeam.mutate(false)}
                    disabled={completeTeam.isPending}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold bg-purple-600 text-white shadow-md shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50"
                  >
                    {completeTeam.isPending ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                    Continue to plan
                  </button>
                  <button
                    type="button"
                    onClick={() => completeTeam.mutate(true)}
                    disabled={completeTeam.isPending}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 transition-all"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: PLAN ─────────────────────────────────────── */}
            {currentStep === 'plan' && (
              <div className="space-y-5">
                {/* Trial callout */}
                <div className="flex items-start gap-3 rounded-lg border border-accent-border bg-accent/40 dark:bg-violet-950/30 dark:border-violet-800/50 px-4 py-3">
                  <CheckCircle2 size={16} className="text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Your <strong className="text-zinc-900 dark:text-white">14-day free trial</strong> is already running. You won't be charged until you choose a paid plan and add a card.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      key: 'free',
                      title: 'Free trial',
                      price: 'Free for 14 days',
                      desc: 'Full access during trial. Upgrade when you\'re ready.',
                      icon: ShieldCheck,
                      recommended: false,
                    },
                    {
                      key: 'pro',
                      title: 'Professional',
                      price: '$29 / month',
                      desc: 'Custom domain, API access, advanced analytics, priority support.',
                      icon: Rocket,
                      recommended: true,
                    },
                    {
                      key: 'team',
                      title: 'Enterprise',
                      price: 'Custom pricing',
                      desc: 'Unlimited workspaces, SSO, dedicated support, SLA guarantee.',
                      icon: Sparkles,
                      recommended: false,
                    },
                  ].map(({ key, title, price, desc, icon: Icon, recommended }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPlan(key as SubscriptionPlan)}
                      className={`w-full flex items-start gap-4 rounded-lg border p-4 text-left transition-all ${
                        selectedPlan === key
                          ? 'border-primary bg-accent/40 dark:bg-violet-950/30 dark:border-violet-500 ring-2 ring-primary/10'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all ${selectedPlan === key ? 'bg-primary text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white">{title}</span>
                          {recommended && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-primary mt-0.5">{price}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{desc}</div>
                      </div>
                      <div className={`flex-shrink-0 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedPlan === key ? 'border-primary bg-primary' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {selectedPlan === key && <Check size={11} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-all"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => savePlan.mutate()}
                    disabled={savePlan.isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold bg-purple-600 text-white shadow-md shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50"
                  >
                    {savePlan.isPending
                      ? <><Loader2 className="animate-spin" size={15} /> Finishing setup…</>
                      : <><Check size={15} /> Finish setup</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* What unlocks next — shown on steps 1-4 */}
            {currentStep !== 'plan' && (
              <div className="mt-10 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-4">
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
                  Unlocks when complete
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: FileText, label: 'Post editor' },
                    { icon: Users,    label: 'Team tools' },
                    { icon: BarChart3, label: 'Analytics' },
                    { icon: Building2, label: 'All settings' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                      <Icon size={13} className="text-zinc-300 dark:text-zinc-600" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

// ─── Shared continue/back buttons ─────────────────────────────────────────
const StepActions = ({
  onContinue,
  onBack,
  loading = false,
  disabled = false,
  showBack = true,
}: {
  onContinue: () => void;
  onBack?: () => void;
  loading?: boolean;
  disabled?: boolean;
  showBack?: boolean;
}) => (
  <div className="flex gap-3 pt-2">
    {showBack && onBack && (
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-all"
      >
        <ArrowLeft size={14} /> Back
      </button>
    )}
    <button
      type="button"
      onClick={onContinue}
      disabled={loading || disabled}
      className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-white bg-purple-600 shadow-md shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? <><Loader2 className="animate-spin" size={15} /> Saving…</>
        : <><ArrowRight size={15} /> Save and continue</>
      }
    </button>
  </div>
);