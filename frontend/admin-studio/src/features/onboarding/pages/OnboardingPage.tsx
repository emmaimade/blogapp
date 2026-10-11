import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { detectUserTimezone } from '../../../shared/utils/dates';
import {
  ArrowRight, ArrowLeft, Check, Loader2,
  Rocket, ShieldCheck, Sparkles, Users,
  CheckCircle2, Globe, FileText, BarChart3, Building2, HelpCircle, UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useAuth } from '../../auth/context/AuthContext';
import { InkoLogo } from '../../../assets/inko';
import { EmailVerificationBanner, EmailVerificationCard } from '../../auth/components/EmailVerificationBanner';
import { SupportModal } from '../../support/components/SupportModal';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { PLANS, TRIAL_DAYS, formatNaira, type PlanKey } from '../../../shared/lib/plans';

const planPrice = (key: PlanKey) => PLANS.find((plan) => plan.key === key)?.price.monthly ?? 0;

type SubscriptionPlan = 'free' | 'pro' | 'team';
type OnboardingStepKey = 'about' | 'profile' | 'publication' | 'plan';

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

// Inviting the team isn't a step: a workspace is on Free (one seat) until the
// plan step, so invites go out from the ready screen instead.
const STEP_ORDER: OnboardingStepKey[] = ['about', 'profile', 'publication', 'plan'];

const TIMEZONES = [
  'UTC',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Accra',
  'Africa/Dar_es_Salaam',
  'Africa/Abidjan',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'Europe/Rome',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

const STEP_META: Record<OnboardingStepKey, { label: string; hint: string }> = {
  about:       { label: 'About you',     hint: 'Your role and what you\'re building' },
  profile:     { label: 'Blog profile',  hint: 'Name, tagline, and category' },
  publication: { label: 'Publishing',    hint: 'Visibility, comments, and timezone' },
  plan:        { label: 'Choose plan',   hint: 'Free trial or paid' },
};

const inputClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-violet-500';

const selectClass = inputClass;

const tileClass = (selected: boolean) =>
  `rounded-lg border text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
    selected
      ? 'border-primary bg-accent text-accent-text dark:bg-violet-950/40 dark:border-violet-500 dark:text-violet-300'
      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
  }`;

/**
 * `htmlFor` ties the label to a single input; `labelId` lets a tile group
 * (role="radiogroup") name itself with aria-labelledby instead.
 */
const Field = ({
  label, hint, htmlFor, labelId, required, children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  labelId?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="self-stretch h-full flex flex-col">
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} id={labelId} className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
    <div className="mt-auto pt-1.5">{children}</div>
  </div>
);

const submitWith = (action: () => void) => (e: FormEvent) => {
  e.preventDefault();
  action();
};

export const OnboardingPage = () => {
  const toWorkspace = useWorkspacePath();
  useDocumentTitle('Set up your blog');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeBlog, requiresOnboarding } = useBlog();
  const { user, refreshUser } = useAuth();

  const [checkingVerification, setCheckingVerification] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>('about');
  const [done, setDone] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const hasInitialized = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(currentStep);

  const [aboutForm, setAboutForm] = useState({
    owner_role: 'blogger',
    workspace_type: 'personal_blog',
    team_size: 'solo',
  });
  // logo_url / favicon_url aren't edited here any more (Settings → Branding
  // has real uploads), but they're carried through so saving doesn't wipe them.
  const [profileForm, setProfileForm] = useState({
    name: '',
    tagline: '',
    description: '',
    category: 'Tech',
    primary_language: 'en',
    logo_url: '',
    favicon_url: '',
  });
  // posts_per_page likewise: left to Settings, but still sent.
  const [publicationForm, setPublicationForm] = useState({
    default_post_visibility: 'public',
    comments_enabled: true,
    posts_per_page: 10,
    timezone: detectUserTimezone(),
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

    setAboutForm({ owner_role: blog.owner_role ?? 'blogger', workspace_type: blog.workspace_type ?? 'personal_blog', team_size: blog.team_size ?? 'solo' });
    setProfileForm({ name: blog.name ?? '', tagline: blog.tagline ?? '', description: blog.description ?? '', category: blog.category ?? 'Tech', primary_language: blog.primary_language ?? 'en', logo_url: blog.logo_url ?? '', favicon_url: blog.favicon_url ?? '' });
    // A new blog's timezone is the server default (UTC), not a choice — until
    // the publishing step is saved, offer the browser's timezone instead.
    const timezone = summary.checklist.publication ? blog.timezone ?? 'UTC' : detectUserTimezone();
    setPublicationForm({ default_post_visibility: blog.default_post_visibility ?? 'public', comments_enabled: blog.comments_enabled, posts_per_page: blog.posts_per_page ?? 10, timezone });
    setSelectedPlan(subscription?.plan ?? 'free');

    if (!hasInitialized.current) {
      setCurrentStep(STEP_ORDER.includes(summary.current_step) ? summary.current_step : 'plan');
      hasInitialized.current = true;
    }
  }, [onboardingQuery.data]);

  useEffect(() => {
    if (activeBlog && !requiresOnboarding && !done) navigate(toWorkspace('/dashboard'), { replace: true });
  }, [activeBlog, navigate, requiresOnboarding, toWorkspace, done]);

  // A new step starts at its top, with focus on its heading for screen
  // readers — otherwise Continue at the bottom of a long step lands mid-way
  // down the next one.
  useEffect(() => {
    if (previousStep.current === currentStep) return;
    previousStep.current = currentStep;
    mainRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

  const syncAfterSave = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['onboarding', activeBlog?.id] }),
      refreshUser(),
    ]);
  };

  const onSaveError = (err: unknown) => toastApiError(err, "Couldn't save this step. Please try again.");

  const saveAbout = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/about`, aboutForm),
    onError: onSaveError,
    onSuccess: async () => {
      setCurrentStep('profile');
      await syncAfterSave();
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/profile`, profileForm),
    onError: onSaveError,
    onSuccess: async () => {
      setCurrentStep('publication');
      await syncAfterSave();
    },
  });

  const savePublication = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/publication`, publicationForm),
    onError: onSaveError,
    onSuccess: async () => {
      setCurrentStep('plan');
      await syncAfterSave();
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => api.put(`/blogs/${activeBlog?.id}/onboarding/plan`, { plan: selectedPlan }),
    onError: (err) => toastApiError(err, "Couldn't save your plan. Please try again."),
    onSuccess: async () => {
      setDone(true);
      await syncAfterSave();
    },
  });

  const emailVerified = !!user?.email_verified;

  const handleLaunch = async () => {
    setCheckingVerification(true);
    try {
      // The verification link may have been opened in another tab since
      // this page loaded — ask the server rather than trust local state.
      const freshUser = await refreshUser();
      if (!freshUser?.email_verified) {
        toast.error('Please verify your email before launching your blog.');
        return;
      }
      savePlan.mutate();
    } catch {
      toast.error('Could not confirm verification status. Please try again.');
    } finally {
      setCheckingVerification(false);
    }
  };

  const progress = onboardingQuery.data?.summary;
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const goBack = () => {
    if (currentIndex > 0) setCurrentStep(STEP_ORDER[currentIndex - 1]);
  };

  if (!activeBlog || onboardingQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="animate-spin text-primary" size={28} aria-label="Loading" />
      </div>
    );
  }

  if (onboardingQuery.isError || !onboardingQuery.data || !progress) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-10 text-center max-w-sm w-full">
          <ShieldCheck className="mx-auto mb-4 text-red-500" size={28} />
          <h2 className="font-bold text-zinc-900 dark:text-white mb-2">Could not load onboarding</h2>
          <button onClick={() => onboardingQuery.refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const canInvite = selectedPlan !== 'free';
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 sm:p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-green-500" size={32} />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">
            {activeBlog.name} is ready
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            {canInvite
              ? 'Your workspace is fully unlocked. Write your first post, or bring your team in to start collaborating.'
              : 'Your workspace is fully unlocked. Write your first post — and when you want teammates, upgrade from Settings → Billing.'}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate(toWorkspace('/dashboard'), { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-white hover:bg-primary-hover transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              Go to dashboard <ArrowRight size={16} />
            </button>
            {canInvite && (
              <button
                onClick={() => navigate(toWorkspace('/users'), { replace: true })}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <UserPlus size={16} /> Invite your team
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    // h-dvh, not min-h-screen: the page must not grow past the viewport, so
    // <main> is the only thing that scrolls and the header stays put.
    <div className="h-dvh bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
            <InkoLogo size={28} />
          </div>
          <span className="text-xl font-black text-zinc-900 dark:text-white">
            Inko
          </span>
          <span className="hidden sm:block text-zinc-300 dark:text-zinc-700">
            ·
          </span>
          <span className="hidden sm:block text-sm text-zinc-500 dark:text-zinc-400">
            Workspace setup
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {progress.completed_steps} / {progress.total_steps}
            <span className="hidden sm:inline"> completed</span>
          </span>
          <div
            className="hidden sm:block w-32 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent_complete}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress.percent_complete}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Contact support"
          >
            <HelpCircle size={15} />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>
      </header>

      <SupportModal open={showSupportModal} onClose={() => setShowSupportModal(false)} />

      <EmailVerificationBanner />

      <div className="flex-1 min-h-0 flex">
        <nav aria-label="Setup steps" className="hidden md:flex flex-col w-56 flex-shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-8">
          {STEP_ORDER.map((step, i) => {
            const stepDone = progress.checklist[step];
            const active = step === currentStep;
            const locked = !stepDone && i > currentIndex && !active;
            const isLast = i === STEP_ORDER.length - 1;
            const meta = STEP_META[step];
            return (
              <div key={step} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => !locked && setCurrentStep(step)}
                  disabled={locked}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                    active
                      ? "bg-accent dark:bg-violet-950/40"
                      : stepDone
                        ? "bg-green-50/60 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30 cursor-pointer"
                        : locked
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      stepDone
                        ? "bg-green-500 text-white dark:bg-green-600"
                        : active
                          ? "bg-primary text-white"
                          : locked
                            ? "border-2 border-zinc-200 dark:border-zinc-700 text-zinc-400"
                            : "border-2 border-zinc-300 dark:border-zinc-600 text-zinc-500"
                    }`}
                  >
                    {stepDone ? <Check size={12} aria-label="Done" /> : i + 1}
                  </div>

                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold leading-none ${
                        active
                          ? "text-primary"
                          : stepDone
                            ? "text-green-700 dark:text-green-400"
                            : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {meta.label}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 leading-snug">
                      {meta.hint}
                    </div>
                  </div>
                </button>

                {!isLast && (
                  <div className="flex justify-start pl-[1.375rem]">
                    <div
                      className={`w-px h-3 transition-colors duration-300 ${
                        stepDone
                          ? "bg-green-300 dark:bg-green-700"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            <div className="mb-8">
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                Step {currentIndex + 1} of {STEP_ORDER.length}
                <span className="md:hidden normal-case tracking-normal text-zinc-500"> · {STEP_META[currentStep].label}</span>
              </div>
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-black text-zinc-900 dark:text-white outline-none">
                {currentStep === "about" && "Tell us about your setup"}
                {currentStep === "profile" && "Set up your blog profile"}
                {currentStep === "publication" &&
                  "Configure publishing defaults"}
                {currentStep === "plan" && "Choose how you want to start"}
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {currentStep === "about" &&
                  "This helps us personalise the admin studio for how your team works."}
                {currentStep === "profile" &&
                  "The basics readers will see. You can update these any time in Settings."}
                {currentStep === "publication" &&
                  "Set sensible defaults once. Every new post will inherit these."}
                {currentStep === "plan" &&
                  `Try Pro or Team free for ${TRIAL_DAYS} days — no card needed — or start on Free and upgrade when you're ready. You can invite your team right after.`}
              </p>
            </div>

            {/* ── STEP: ABOUT ─────────────────────────────────────── */}
            {currentStep === "about" && (
              <form className="space-y-5" onSubmit={submitWith(() => saveAbout.mutate())}>
                <Field label="Your role" htmlFor="onb-role">
                  <select
                    id="onb-role"
                    className={selectClass}
                    value={aboutForm.owner_role}
                    onChange={(e) =>
                      setAboutForm((p) => ({
                        ...p,
                        owner_role: e.target.value,
                      }))
                    }
                  >
                    <option value="blogger">Blogger / Creator</option>
                    <option value="agency">Agency</option>
                    <option value="saas_company">SaaS company</option>
                    <option value="content_team">Content team</option>
                  </select>
                </Field>
                <Field label="What are you building?" htmlFor="onb-workspace-type">
                  <select
                    id="onb-workspace-type"
                    className={selectClass}
                    value={aboutForm.workspace_type}
                    onChange={(e) =>
                      setAboutForm((p) => ({
                        ...p,
                        workspace_type: e.target.value,
                      }))
                    }
                  >
                    <option value="personal_blog">Personal blog</option>
                    <option value="client_blogs">Client blogs</option>
                    <option value="company_blog">Company blog</option>
                    <option value="developer_docs">Developer docs</option>
                  </select>
                </Field>
                <Field label="Team size" labelId="onb-team-size">
                  <div role="radiogroup" aria-labelledby="onb-team-size" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: "solo", label: "Just me" },
                      { value: "small", label: "2 – 5" },
                      { value: "growing", label: "6 – 20" },
                      { value: "large", label: "20+" },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={aboutForm.team_size === value}
                        onClick={() =>
                          setAboutForm((p) => ({ ...p, team_size: value }))
                        }
                        className={`${tileClass(aboutForm.team_size === value)} py-3`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <StepActions
                  loading={saveAbout.isPending}
                  showBack={false}
                />
              </form>
            )}

            {/* ── STEP: PROFILE ──────────────────────────────────── */}
            {currentStep === "profile" && (
              <form className="space-y-5" onSubmit={submitWith(() => saveProfile.mutate())}>
                <Field label="Blog display name" htmlFor="onb-name" required>
                  <input
                    id="onb-name"
                    required
                    className={inputClass}
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="My Awesome Blog"
                  />
                </Field>
                <Field
                  label="Tagline"
                  htmlFor="onb-tagline"
                  required
                  hint="One sentence that captures what your blog is about."
                >
                  <input
                    id="onb-tagline"
                    required
                    className={inputClass}
                    value={profileForm.tagline}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, tagline: e.target.value }))
                    }
                    placeholder="Your ideas, amplified"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Category" htmlFor="onb-category">
                    <select
                      id="onb-category"
                      className={selectClass}
                      value={profileForm.category}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          category: e.target.value,
                        }))
                      }
                    >
                      {[
                        "Tech",
                        "Business",
                        "Lifestyle",
                        "Marketing",
                        "Education",
                        "Design",
                        "Other",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Primary language" htmlFor="onb-language">
                    <select
                      id="onb-language"
                      className={selectClass}
                      value={profileForm.primary_language}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          primary_language: e.target.value,
                        }))
                      }
                    >
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="es">Spanish</option>
                      <option value="de">German</option>
                      <option value="pt">Portuguese</option>
                    </select>
                  </Field>
                </div>

                <Field
                  label="Description"
                  htmlFor="onb-description"
                  hint="Optional — shown on your blog's about page."
                >
                  <textarea
                    id="onb-description"
                    className={`${inputClass} min-h-24 resize-none`}
                    value={profileForm.description}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="A short paragraph about what you publish…"
                  />
                </Field>

                <p className="text-xs text-zinc-500">
                  You can upload a logo and favicon later in Settings → Branding.
                </p>

                <StepActions
                  onBack={goBack}
                  loading={saveProfile.isPending}
                  disabled={!profileForm.name.trim() || !profileForm.tagline.trim()}
                  disabledReason="Add a name and a tagline to continue."
                />
              </form>
            )}

            {/* ── STEP: PUBLICATION ──────────────────────────────── */}
            {currentStep === "publication" && (
              <form className="space-y-5" onSubmit={submitWith(() => savePublication.mutate())}>
                <Field
                  label="Default post visibility"
                  labelId="onb-visibility"
                  hint="New posts will inherit this setting. Authors can override per post."
                >
                  <div role="radiogroup" aria-labelledby="onb-visibility" className="grid grid-cols-3 gap-2">
                    {[
                      { value: "public", label: "Public", icon: Globe },
                      {
                        value: "members_only",
                        label: "Members only",
                        icon: Users,
                      },
                      {
                        value: "paid_only",
                        label: "Paid only",
                        icon: ShieldCheck,
                      },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={publicationForm.default_post_visibility === value}
                        onClick={() =>
                          setPublicationForm((p) => ({
                            ...p,
                            default_post_visibility: value,
                          }))
                        }
                        className={`${tileClass(publicationForm.default_post_visibility === value)} flex flex-col items-center gap-2 px-1 py-4 text-xs text-center`}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field
                  label="Timezone"
                  htmlFor="onb-timezone"
                  hint="Used for scheduling and post timestamps. Auto-detected from your browser."
                >
                  <select
                    id="onb-timezone"
                    className={selectClass}
                    value={publicationForm.timezone}
                    onChange={(e) =>
                      setPublicationForm((p) => ({
                        ...p,
                        timezone: e.target.value,
                      }))
                    }
                  >
                    {!TIMEZONES.includes(publicationForm.timezone) && (
                      <option value={publicationForm.timezone}>
                        {publicationForm.timezone} (detected)
                      </option>
                    )}
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </Field>

                <label
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                    publicationForm.comments_enabled
                      ? "border-primary bg-accent/40 dark:bg-violet-950/30 dark:border-violet-700"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={publicationForm.comments_enabled}
                    onChange={(e) =>
                      setPublicationForm((p) => ({
                        ...p,
                        comments_enabled: e.target.checked,
                      }))
                    }
                    className="accent-primary w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Enable comments by default
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Readers can comment on posts. You can moderate in
                      Comments.
                    </div>
                  </div>
                </label>

                <StepActions
                  onBack={goBack}
                  loading={savePublication.isPending}
                />
              </form>
            )}

            {/* ── STEP: PLAN ─────────────────────────────────────── */}
            {currentStep === "plan" && (
              <form className="space-y-5" onSubmit={submitWith(handleLaunch)}>
                <EmailVerificationCard />

                <div className="flex items-start gap-3 rounded-lg border border-accent-border bg-accent/40 dark:bg-violet-950/30 dark:border-violet-800/50 px-4 py-3">
                  <CheckCircle2
                    size={16}
                    className="text-primary flex-shrink-0 mt-0.5"
                  />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Pro and Team start with a{" "}
                    <strong className="text-zinc-900 dark:text-white">
                      {TRIAL_DAYS}-day free trial
                    </strong>
                    . You won't be charged — when the trial ends you move to
                    Free unless you add a payment in Settings → Billing.
                  </p>
                </div>

                <div role="radiogroup" aria-label="Plan" className="space-y-3">
                  {[
                    {
                      key: "free",
                      title: "Free",
                      price: "₦0 — free forever",
                      desc: "1 member, up to 30 published posts. Upgrade any time.",
                      icon: ShieldCheck,
                      recommended: false,
                    },
                    {
                      key: "pro",
                      title: "Pro",
                      price: `${TRIAL_DAYS} days free, then ${formatNaira(planPrice('pro'))} / month`,
                      desc: "Up to 3 members, unlimited posts, scheduled publishing, no Inko branding.",
                      icon: Rocket,
                      recommended: true,
                    },
                    {
                      key: "team",
                      title: "Team",
                      price: `${TRIAL_DAYS} days free, then ${formatNaira(planPrice('team'))} / month`,
                      desc: "Up to 15 members, a year of activity history, priority support.",
                      icon: Sparkles,
                      recommended: false,
                    },
                  ].map(
                    ({ key, title, price, desc, icon: Icon, recommended }) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selectedPlan === key}
                        onClick={() => setSelectedPlan(key as SubscriptionPlan)}
                        className={`w-full flex items-start gap-4 rounded-lg border p-4 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                          selectedPlan === key
                            ? "border-primary bg-accent/40 dark:bg-violet-950/30 dark:border-violet-500 ring-2 ring-primary/10"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all ${selectedPlan === key ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-zinc-900 dark:text-white">
                              {title}
                            </span>
                            {recommended && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                                Popular
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-primary mt-0.5">
                            {price}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {desc}
                          </div>
                        </div>
                        <div
                          className={`flex-shrink-0 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedPlan === key
                              ? "border-primary bg-primary"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {selectedPlan === key && (
                            <Check size={11} className="text-white" />
                          )}
                        </div>
                      </button>
                    ),
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <BackButton onClick={goBack} />
                  <button
                    type="submit"
                    disabled={!emailVerified || savePlan.isPending || checkingVerification}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savePlan.isPending || checkingVerification ? (
                      <>
                        <Loader2 className="animate-spin" size={15} /> Launching
                        your blog…
                      </>
                    ) : (
                      <>
                        <Check size={15} /> Launch my blog
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {currentStep !== "plan" && (
              <div className="mt-10 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  Unlocks when complete
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: FileText, label: "Post editor" },
                    { icon: Users, label: "Team tools" },
                    { icon: BarChart3, label: "Analytics" },
                    { icon: Building2, label: "All settings" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 text-xs text-zinc-500"
                    >
                      <Icon
                        size={13}
                        className="text-zinc-400 dark:text-zinc-600"
                      />
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
const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
  >
    <ArrowLeft size={14} /> Back
  </button>
);

// Continue is a submit button, so Enter in any field moves the step on.
const StepActions = ({
  onBack,
  loading = false,
  disabled = false,
  disabledReason,
  showBack = true,
}: {
  onBack?: () => void;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  showBack?: boolean;
}) => (
  <div className="pt-2">
    <div className="flex flex-col-reverse sm:flex-row gap-3">
      {showBack && onBack && <BackButton onClick={onBack} />}
      <button
        type="submit"
        disabled={loading || disabled}
        className="flex items-center justify-center gap-2 rounded-lg text-sm font-bold bg-primary text-white px-6 py-3.5 shadow-md shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading
          ? <><Loader2 className="animate-spin" size={15} /> Saving…</>
          : <><ArrowRight size={15} /> Save and continue</>
        }
      </button>
    </div>
    {disabled && disabledReason && (
      <p className="mt-2 text-xs text-zinc-500">{disabledReason}</p>
    )}
  </div>
);
