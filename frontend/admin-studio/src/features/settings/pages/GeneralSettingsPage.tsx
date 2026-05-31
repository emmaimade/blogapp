import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Globe, Loader2, AlertCircle, ExternalLink, Copy, CheckCircle2, Lock, Zap, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-violet-500';

export const GeneralSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const [copied, setCopied] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);

  // ── Subscription query — drives domain plan gating ──────────────────────
  const { data: subscription } = useQuery({
    queryKey: ['subscription', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog?.id}/subscription`)).data,
    enabled: !!activeBlog?.id,
  });
  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'team';

  // ── General settings ─────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery({
    queryKey: ['generalSettings', activeBlog?.id],
    queryFn: async () => {
      let data: any = {};
      try {
        const res = await api.get('/settings/general');
        data = res.data || {};
      } catch {
        // Use activeBlog as fallback
      }
      
      // If the backend returned default values (e.g. 'Inko'), override them with the 
      // actual blog settings configured during onboarding if they exist.
      return {
        site_name: (data.site_name && data.site_name !== 'Inko') ? data.site_name : (activeBlog?.name || 'Inko'),
        site_tagline: (data.site_tagline && data.site_tagline !== 'Your ideas, amplified') ? data.site_tagline : (activeBlog?.tagline || ''),
        site_description: data.site_description || activeBlog?.description || '',
        timezone: (data.timezone && data.timezone !== 'UTC') ? data.timezone : (activeBlog?.timezone || 'UTC'),
        language: (data.language && data.language !== 'en') ? data.language : (activeBlog?.primary_language || 'en'),
        posts_per_page: (data.posts_per_page && data.posts_per_page !== 10) ? data.posts_per_page : (activeBlog?.posts_per_page || 10),
      };
    },
    enabled: !!activeBlog?.id,
  });

  const [formData, setFormData] = useState(settings || {});

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (activeBlog?.custom_domain) setCustomDomainInput(activeBlog.custom_domain);
  }, [activeBlog]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/general', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generalSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allSettings'] });
      toast.success('General settings saved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    },
  });

  const saveDomain = async () => {
    if (!activeBlog?.id) return;
    setSavingDomain(true);
    try {
      await api.patch(`/blogs/${activeBlog.id}`, { custom_domain: customDomainInput || null });
      queryClient.invalidateQueries({ queryKey: ['blog', activeBlog.id] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      toast.success(customDomainInput ? 'Custom domain saved' : 'Custom domain removed');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const subdomain = activeBlog?.subdomain ?? '';
  const customDomain = activeBlog?.custom_domain;
  const liveUrl = customDomain ? `https://${customDomain}` : `https://${subdomain}.inko.blog`;
  const displayUrl = customDomain ?? `${subdomain}.inko.blog`;

  const handleCopy = () => {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDirty = settings && (
    formData.site_name !== settings.site_name ||
    formData.site_tagline !== settings.site_tagline ||
    formData.site_description !== settings.site_description ||
    formData.timezone !== settings.timezone ||
    formData.language !== settings.language ||
    formData.posts_per_page !== settings.posts_per_page
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl pb-24 animate-pulse">
        <div className="flex items-start gap-3 rounded-2xl bg-zinc-100 p-5 dark:bg-zinc-800/50">
          <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2 w-full pt-1">
            <div className="h-5 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
        <div className="admin-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="h-6 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="space-y-6 p-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className={`w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50 ${i === 2 ? 'h-24' : 'h-10'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-12 relative">
      {/* Floating Save Button */}
      <div className={`fixed top-[76px] right-6 md:right-10 z-50 transition-all duration-300 ${isDirty ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3 rounded-full border border-zinc-200/50 bg-white/80 p-1.5 pl-4 shadow-lg backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Unsaved changes
            </span>
          </div>
          <button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending}
            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
            Save
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 border border-indigo-100 p-5 dark:bg-indigo-950/30 dark:border-indigo-900/50">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 mt-0.5">
          <AlertCircle size={16} />
        </div>
        <div className="text-sm text-indigo-900 dark:text-indigo-300">
          <p className="mb-1 font-bold text-base">Site-wide defaults</p>
          <p className="opacity-80">These settings apply across your entire workspace and determine how it appears to visitors globally.</p>
        </div>
      </div>

      {/* ── DOMAIN SECTION ─────────────────────────────────────────────────── */}
      <div className="admin-card overflow-hidden rounded-[1.5rem]">
        <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
            <Globe size={18} className="text-violet-500" />
            Domain
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Your blog's public address and custom domain settings.</p>
        </div>

        <div className="p-6 space-y-6">

          {/* Current live URL */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">
              Blog address
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5">
              <span className="flex-1 text-sm font-mono font-semibold text-zinc-900 dark:text-white truncate">
                {displayUrl}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  title="Copy URL"
                >
                  {copied
                    ? <CheckCircle2 size={15} className="text-green-500" />
                    : <Copy size={15} />
                  }
                </button>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400"
                  title="Open blog in new tab"
                >
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Your subdomain is <strong className="text-zinc-700 dark:text-zinc-300">{subdomain}.inko.blog</strong> and cannot be changed after signup.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-100 dark:border-zinc-800" />

          {/* Custom domain */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-300">
                Custom domain
              </label>
              {!isPro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <Lock size={10} /> Pro plan
                </span>
              )}
              {isPro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
                  <Zap size={10} /> Available on your plan
                </span>
              )}
            </div>

            {isPro ? (
              <>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={customDomainInput}
                    onChange={(e) => setCustomDomainInput(e.target.value)}
                    placeholder="blog.yoursite.com"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={saveDomain}
                    disabled={savingDomain}
                    className="flex-shrink-0 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all disabled:opacity-50"
                  >
                    {savingDomain ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                    Save
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">DNS setup instructions</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Point a <strong>CNAME</strong> record from your domain to{' '}
                    <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                      {subdomain}.inko.blog
                    </code>
                  </p>
                  <p className="text-xs text-zinc-400">DNS changes can take up to 48 hours to propagate.</p>
                </div>
                {customDomain && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 size={13} />
                    Custom domain active — <strong>{customDomain}</strong>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-5">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Connect your own domain (like <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">blog.yoursite.com</code>) instead of the default <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{subdomain}.inko.blog</code> address.
                </p>
                <Link
                  to="/admin/settings/general"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all"
                >
                  <Zap size={15} /> Upgrade to Pro <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SITE IDENTITY ──────────────────────────────────────────────────── */}
      <div className="admin-card overflow-hidden rounded-[1.5rem]">
        <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
            <Globe size={18} className="text-zinc-400" />
            Site Identity
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Configure your basic workspace information.</p>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">Workspace Name</label>
            <input
              type="text"
              value={(formData as any).site_name || ''}
              onChange={(e) => handleChange('site_name', e.target.value)}
              placeholder="Inko Workspace"
              className={inputClass}
            />
            <p className="mt-2 text-xs text-zinc-500">Your workspace name as shown in the navigation, footer, and browser title.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">Tagline</label>
            <input
              type="text"
              value={(formData as any).site_tagline || ''}
              onChange={(e) => handleChange('site_tagline', e.target.value)}
              placeholder="Your ideas, amplified"
              className={inputClass}
            />
            <p className="mt-2 text-xs text-zinc-500">A short phrase that describes the site's positioning.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">Description</label>
            <textarea
              value={(formData as any).site_description || ''}
              onChange={(e) => handleChange('site_description', e.target.value)}
              placeholder="A modern blog CMS for sharing your stories and ideas"
              rows={4}
              className={`${inputClass} resize-none`}
            />
            <p className="mt-2 text-xs text-zinc-500">Used for SEO metadata and social sharing previews.</p>
          </div>
        </div>
      </div>

      {/* ── DISPLAY PREFERENCES ────────────────────────────────────────────── */}
      <div className="admin-card overflow-hidden rounded-[1.5rem]">
        <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Display Preferences</h2>
          <p className="mt-1 text-sm text-zinc-500">Customize how content is rendered to visitors.</p>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">Posts Per Page</label>
            <input
              type="number"
              min="1"
              max="50"
              value={(formData as any).posts_per_page || 10}
              onChange={(e) => handleChange('posts_per_page', parseInt(e.target.value, 10))}
              className={inputClass}
            />
            <p className="mt-2 text-xs text-zinc-500">Set the number of posts shown on paginated listing pages.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">Timezone</label>
              <select
                value={(formData as any).timezone || 'UTC'}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className={inputClass}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
              <p className="mt-2 text-xs text-zinc-500">Publish and update timestamps.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-300">Language</label>
              <select
                value={(formData as any).language || 'en'}
                onChange={(e) => handleChange('language', e.target.value)}
                className={inputClass}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
              <p className="mt-2 text-xs text-zinc-500">Default locale for public UI elements.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};