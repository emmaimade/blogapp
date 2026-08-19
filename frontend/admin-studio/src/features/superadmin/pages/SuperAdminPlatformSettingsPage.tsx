import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import { Save, Globe, Mail, Shield, Zap, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { SettingsSkeleton } from '../../../shared/ui/SettingsSkeleton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface PlatformSettingsForm {
  platform_name: string;
  platform_url: string;
  support_email: string;
  max_blogs_per_user: number;
  max_members_per_blog: number;
  allow_public_signup: boolean;
  require_email_verification: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from: string;
  enable_google_auth: boolean;
  enable_github_auth: boolean;
  session_timeout_hours: number;
  enforce_2fa_superadmin: boolean;
  feature_custom_domains: boolean;
  feature_api_access: boolean;
  feature_analytics: boolean;
  feature_sso: boolean;
  feature_comments: boolean;
  feature_newsletters: boolean;
}

const defaultPlatformSettings: PlatformSettingsForm = {
  platform_name: 'INKO',
  platform_url: 'https://inko.blog',
  support_email: 'support@inko.blog',
  max_blogs_per_user: 5,
  max_members_per_blog: 20,
  allow_public_signup: true,
  require_email_verification: true,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_from: 'noreply@inko.blog',
  enable_google_auth: true,
  enable_github_auth: false,
  session_timeout_hours: 24,
  enforce_2fa_superadmin: true,
  feature_custom_domains: true,
  feature_api_access: true,
  feature_analytics: true,
  feature_sso: false,
  feature_comments: true,
  feature_newsletters: false,
};

const fetchPlatformSettings = async () => {
  const res = await axios.get(`${API_URL}/superadmin/platform-settings`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

const savePlatformSettings = async (data: any) => {
  const res = await axios.patch(`${API_URL}/superadmin/platform-settings`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  return res.data;
};

type SettingsTab = 'general' | 'email' | 'security' | 'features';

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${value ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const inputClass = "w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all";
const labelClass = "block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5";

export const SuperAdminPlatformSettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
  });

  const [form, setForm] = useState<PlatformSettingsForm>({
    ...defaultPlatformSettings,
    ...settings,
  });
  const [savedForm, setSavedForm] = useState<PlatformSettingsForm>({
    ...defaultPlatformSettings,
    ...settings,
  });

  // Settings load asynchronously; sync form + baseline once the real data arrives
  // instead of only reading it on the very first (pre-fetch) render.
  useEffect(() => {
    if (!settings) return;
    const merged = { ...defaultPlatformSettings, ...settings };
    setForm(merged);
    setSavedForm(merged);
  }, [settings]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  // Browser-level guard: refresh, close tab, or navigate to another site.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // In-app guard: navigating to another route within the app.
  // NOTE: useBlocker only works with a data router (createBrowserRouter /
  // createRoutesFromElements). It throws if the app still uses <BrowserRouter>.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const set = <K extends keyof PlatformSettingsForm>(key: K, value: PlatformSettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: savePlatformSettings,
    onSuccess: (_data, variables) => {
      setSavedForm(variables);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'general',  label: 'General',  icon: <Globe size={15} /> },
    { key: 'email',    label: 'Email',    icon: <Mail size={15} /> },
    { key: 'security', label: 'Security', icon: <Shield size={15} /> },
    { key: 'features', label: 'Features', icon: <Zap size={15} /> },
  ];

  const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-700 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 max-w-full sm:max-w-4xl mx-auto">
        <SettingsSkeleton cardsCount={1} fieldsPerCard={4} />
      </div>
    );
  }

  return (
    <>
    <div className={`p-4 sm:p-8 max-w-full sm:max-w-4xl mx-auto space-y-6 ${isDirty ? 'pb-28 sm:pb-8' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Platform Settings</h1>
          <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400">Configure global platform behaviour and feature availability.</p>
        </div>
        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="hidden sm:flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <><Loader2 size={15} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 size={15} /> Saved</>
          ) : (
            <><Save size={15} /> Save changes</>
          )}
        </button>
      </div>

      {/* Tabs — equal-width, always fits, matches the Posts page pill pattern */}
      <div className="flex items-stretch gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span className="hidden sm:inline-flex">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">

        {activeTab === 'general' && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700">Platform Identity</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Platform name</label>
                <input className={inputClass} value={form.platform_name} onChange={(e) => set('platform_name', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Platform URL</label>
                <input className={inputClass} value={form.platform_url} onChange={(e) => set('platform_url', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Support email</label>
                <input type="email" className={inputClass} value={form.support_email} onChange={(e) => set('support_email', e.target.value)} />
              </div>
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700 pt-4">Limits</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Max blogs per user</label>
                <input type="number" className={inputClass} value={form.max_blogs_per_user} onChange={(e) => set('max_blogs_per_user', Number(e.target.value))} />
                <p className="text-xs text-zinc-500 mt-1">Default free tier limit</p>
              </div>
              <div>
                <label className={labelClass}>Max members per blog</label>
                <input type="number" className={inputClass} value={form.max_members_per_blog} onChange={(e) => set('max_members_per_blog', Number(e.target.value))} />
                <p className="text-xs text-zinc-500 mt-1">Default free tier limit</p>
              </div>
            </div>
            <div className="pt-2">
              <SettingRow label="Allow public signup" description="Let anyone register without an invite">
                <Toggle value={form.allow_public_signup} onChange={(v) => set('allow_public_signup', v)} />
              </SettingRow>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700">SMTP Configuration</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>SMTP host</label>
                <input className={inputClass} placeholder="smtp.postmarkapp.com" value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>SMTP port</label>
                <input type="number" className={inputClass} value={form.smtp_port} onChange={(e) => set('smtp_port', Number(e.target.value))} />
              </div>
              <div>
                <label className={labelClass}>SMTP username</label>
                <input className={inputClass} placeholder="your-api-key" value={form.smtp_user} onChange={(e) => set('smtp_user', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>From address</label>
                <input type="email" className={inputClass} value={form.smtp_from} onChange={(e) => set('smtp_from', e.target.value)} />
              </div>
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700 pt-4">Email Behaviour</h2>
            <SettingRow label="Require email verification" description="New users must verify before accessing the platform">
              <Toggle value={form.require_email_verification} onChange={(v) => set('require_email_verification', v)} />
            </SettingRow>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700 mb-2">Authentication</h2>
            <SettingRow label="Google OAuth" description="Allow users to sign in with Google">
              <Toggle value={form.enable_google_auth} onChange={(v) => set('enable_google_auth', v)} />
            </SettingRow>
            <SettingRow label="GitHub OAuth" description="Allow users to sign in with GitHub">
              <Toggle value={form.enable_github_auth} onChange={(v) => set('enable_github_auth', v)} />
            </SettingRow>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700 mt-6 mb-2">Session & 2FA</h2>
            <SettingRow label="Enforce 2FA for super admins" description="Require two-factor authentication on all superadmin accounts">
              <Toggle value={form.enforce_2fa_superadmin} onChange={(v) => set('enforce_2fa_superadmin', v)} />
            </SettingRow>
            <SettingRow label="Session timeout (hours)" description="Inactive sessions are automatically logged out">
              <input
                type="number"
                className="w-24 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 text-right"
                value={form.session_timeout_hours}
                onChange={(e) => set('session_timeout_hours', Number(e.target.value))}
              />
            </SettingRow>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-700 mb-2">Feature Flags</h2>
            <p className="text-xs text-zinc-500 mb-4">Toggle features globally. Plan-level overrides apply on top of these.</p>
            {[
              { key: 'feature_custom_domains', label: 'Custom domains', description: 'Allow workspaces to connect custom domains' },
              { key: 'feature_api_access',     label: 'REST API access', description: 'Enable API key generation for workspaces' },
              { key: 'feature_analytics',      label: 'Analytics', description: 'Show analytics dashboards in tenant portals' },
              { key: 'feature_sso',            label: 'SSO / SAML', description: 'Allow enterprise tenants to configure SSO' },
              { key: 'feature_comments',       label: 'Comments', description: 'Enable comment system on all blogs' },
              { key: 'feature_newsletters',    label: 'Newsletters (beta)', description: 'Allow workspaces to send email newsletters' },
            ].map(({ key, label, description }) => (
              <SettingRow key={key} label={label} description={description}>
                <Toggle value={form[key as keyof PlatformSettingsForm] as boolean} onChange={(v) => set(key as keyof PlatformSettingsForm, v)} />
              </SettingRow>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Mobile dirty-state bottom bar */}
    {isDirty && (
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 shadow-lg"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Unsaved changes</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setForm(savedForm)}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Saving…</>
            ) : (
              <><Save size={15} /> Save</>
            )}
          </button>
        </div>
      </div>
    )}

    {/* In-app navigation guard modal */}
    {blocker.state === 'blocked' && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-yellow-700 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Leave without saving?</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">You have unsaved changes to platform settings. They'll be lost if you leave this page.</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => blocker.reset?.()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Stay on page
            </button>
            <button
              onClick={() => blocker.proceed?.()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              Leave without saving
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};