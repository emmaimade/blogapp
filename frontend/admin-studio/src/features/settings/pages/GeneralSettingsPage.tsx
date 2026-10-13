import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, ExternalLink, Copy, CheckCircle2, Zap, MessageSquare, Trash2, IdCard, LayoutList } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useAuth } from '../../auth/context/AuthContext';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { getBlogDisplayUrl, getBlogUrl } from '../../../shared/lib/blogUrl';
import { usePlanAccess } from '../../billing/hooks/usePlanAccess';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import {
  Field,
  PaidFeatureBadge,
  SwitchRow,
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';
import { LANGUAGES, getTimezoneGroups } from '../lib/locales';

type PostVisibility = 'public' | 'members_only' | 'paid_only';

interface GeneralForm {
  site_name: string;
  site_tagline: string;
  site_description: string;
  timezone: string;
  language: string;
  /** '' while the field is cleared, so typing a new number doesn't fight the input. */
  posts_per_page: number | '';
  // Saved on the blog itself rather than in general settings.
  comments_enabled: boolean;
  default_post_visibility: PostVisibility;
}

const GENERAL_FIELDS = ['site_name', 'site_tagline', 'site_description', 'timezone', 'language', 'posts_per_page'] as const;
const PUBLICATION_FIELDS = ['comments_enabled', 'default_post_visibility'] as const;

// Defaults the platform once saved for every blog. A blog still holding one
// gets its own value instead, so it never shows the platform's text.
const LEGACY_DEFAULTS = { site_name: 'Inko', site_tagline: 'Your ideas, amplified' };

const POSTS_PER_PAGE_MAX = 50;

const postsPerPageError = (value: number | '') =>
  value === '' || !Number.isInteger(value) || value < 1 || value > POSTS_PER_PAGE_MAX
    ? `Enter a whole number from 1 to ${POSTS_PER_PAGE_MAX}.`
    : null;

/** blog.example.com from whatever was pasted — a URL, a trailing slash, capitals. */
const normaliseDomain = (input: string) =>
  input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const GeneralSettings: React.FC = () => {
  useDocumentTitle('General settings');
  const { activeBlog } = useBlog();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const blogId = activeBlog?.id;

  const form = useSettingsForm<GeneralForm>({
    queryKey: ['generalSettings', blogId],
    empty: {
      site_name: '',
      site_tagline: '',
      site_description: '',
      timezone: 'UTC',
      language: 'en',
      posts_per_page: 10,
      comments_enabled: true,
      default_post_visibility: 'public',
    },
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/general`)).data ?? {};
      return {
        site_name: data.site_name && data.site_name !== LEGACY_DEFAULTS.site_name ? data.site_name : activeBlog?.name ?? '',
        site_tagline:
          data.site_tagline && data.site_tagline !== LEGACY_DEFAULTS.site_tagline ? data.site_tagline : activeBlog?.tagline ?? '',
        site_description: data.site_description || activeBlog?.description || '',
        timezone: data.timezone || activeBlog?.timezone || 'UTC',
        language: data.language || activeBlog?.primary_language || 'en',
        posts_per_page: data.posts_per_page || activeBlog?.posts_per_page || 10,
        comments_enabled: activeBlog?.comments_enabled ?? true,
        default_post_visibility: activeBlog?.default_post_visibility ?? 'public',
      };
    },
    validate: (values) => postsPerPageError(values.posts_per_page),
    save: async (values, saved) => {
      if (GENERAL_FIELDS.some((field) => values[field] !== saved[field])) {
        const general = Object.fromEntries(GENERAL_FIELDS.map((field) => [field, values[field]]));
        await api.post(`/blogs/${blogId}/settings/general`, general);
      }
      if (PUBLICATION_FIELDS.some((field) => values[field] !== saved[field])) {
        await api.patch(`/blogs/${blogId}`, {
          comments_enabled: values.comments_enabled,
          default_post_visibility: values.default_post_visibility,
        });
        // These come from the signed-in user's memberships, which only refresh here.
        await refreshUser();
        queryClient.invalidateQueries({ queryKey: ['blog', blogId] });
        queryClient.invalidateQueries({ queryKey: ['blogs'] });
      }
    },
    invalidate: [['allSettings']],
    successMessage: 'General settings saved',
    errorMessage: "Couldn't save general settings",
  });

  const { values, update } = form;
  const timezoneGroups = getTimezoneGroups();
  const timezoneListed = timezoneGroups.some((group) => group.options.some((option) => option.value === values.timezone));

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load general settings" skeletonCards={4}>
      <DomainCard />

      <SettingsCard title="Site identity" icon={IdCard} description="How your blog introduces itself to readers.">
        <Field label="Blog name">
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.site_name}
              onChange={(e) => update('site_name', e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Tagline" hint="A short line shown with your blog name.">
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.site_tagline}
              onChange={(e) => update('site_tagline', e.target.value)}
              placeholder="e.g. Notes on design and code"
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Description" hint="A sentence or two about what readers will find here.">
          {(control) => (
            <textarea
              {...control}
              value={values.site_description}
              onChange={(e) => update('site_description', e.target.value)}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          )}
        </Field>
      </SettingsCard>

      <SettingsCard title="Display" icon={LayoutList} description="Defaults for how your blog shows posts and dates.">
        <Field
          label="Posts per page"
          hint={`How many posts each page of your blog lists, from 1 to ${POSTS_PER_PAGE_MAX}.`}
          error={postsPerPageError(values.posts_per_page)}
        >
          {(control) => (
            <input
              {...control}
              type="number"
              inputMode="numeric"
              min={1}
              max={POSTS_PER_PAGE_MAX}
              value={values.posts_per_page}
              onChange={(e) => update('posts_per_page', e.target.value === '' ? '' : Number(e.target.value))}
              className={`${inputClass} sm:max-w-48`}
            />
          )}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Timezone" hint="Used for post dates and scheduled publishing.">
            {(control) => (
              <select
                {...control}
                value={values.timezone}
                onChange={(e) => update('timezone', e.target.value)}
                className={inputClass}
              >
                {!timezoneListed && <option value={values.timezone}>{values.timezone}</option>}
                {timezoneGroups.map((group) => (
                  <optgroup key={group.region} label={group.region}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>
          <Field label="Language" hint="The language your posts are written in.">
            {(control) => (
              <select
                {...control}
                value={values.language}
                onChange={(e) => update('language', e.target.value)}
                className={inputClass}
              >
                {!LANGUAGES.some((language) => language.value === values.language) && (
                  <option value={values.language}>{values.language}</option>
                )}
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Publishing" icon={MessageSquare} description="Defaults for new posts and how readers can respond.">
        <SwitchRow
          label="Comments"
          description="Let readers comment on your posts."
          checked={values.comments_enabled}
          onChange={(checked) => update('comments_enabled', checked)}
        />
        <Field label="Default post visibility" hint="New posts start with this. You can change it on any post.">
          {(control) => (
            <select
              {...control}
              value={values.default_post_visibility}
              onChange={(e) => update('default_post_visibility', e.target.value as PostVisibility)}
              className={inputClass}
            >
              <option value="public">Public — anyone can read</option>
              <option value="members_only">Members only — signed-in readers</option>
              <option value="paid_only">Paid only — subscribers</option>
            </select>
          )}
        </Field>
      </SettingsCard>
    </SettingsForm>
  );
};

/**
 * The blog's address. Connecting a custom domain is its own action rather than
 * part of the page's save, since it changes where the blog lives.
 */
const DomainCard = () => {
  const { activeBlog } = useBlog();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const toWorkspace = useWorkspacePath();
  const { isPaid } = usePlanAccess();

  const currentDomain = activeBlog?.custom_domain ?? '';
  const [domainInput, setDomainInput] = useState(currentDomain);
  const [saving, setSaving] = useState<'connect' | 'remove' | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setDomainInput(currentDomain), [currentDomain]);

  if (!activeBlog) return null;

  const subdomain = activeBlog.subdomain;
  const liveUrl = getBlogUrl(activeBlog);
  const domain = normaliseDomain(domainInput);
  const domainError = domain && !DOMAIN_PATTERN.test(domain) ? 'Enter a domain like blog.yoursite.com.' : null;
  const canConnect = !!domain && !domainError && domain !== currentDomain;

  const saveDomain = async (next: string | null) => {
    setSaving(next ? 'connect' : 'remove');
    try {
      await api.patch(`/blogs/${activeBlog.id}`, { custom_domain: next });
      queryClient.invalidateQueries({ queryKey: ['blog', activeBlog.id] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      // The address shown here (and on the dashboard) comes from the signed-in
      // user's memberships, which only update after this.
      await refreshUser();
      toast.success(next ? 'Custom domain connected' : 'Custom domain removed');
    } catch (error) {
      toastApiError(error, next ? "Couldn't connect the domain" : "Couldn't remove the domain");
    } finally {
      setSaving(null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the address and copy it instead.");
    }
  };

  const removeButton = currentDomain && (
    <button type="button" onClick={() => saveDomain(null)} disabled={!!saving} className={secondaryButtonClass}>
      {saving === 'remove' ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
      Remove
    </button>
  );

  return (
    <SettingsCard title="Domain" icon={Globe} description="Where readers find your blog.">
      <div>
        <p className={`mb-1.5 ${labelClass}`}>Blog address</p>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-1.5 pl-4 pr-1.5 dark:border-zinc-700 dark:bg-zinc-800">
          <span className="flex-1 truncate font-mono text-sm font-semibold text-zinc-900 dark:text-white">
            {getBlogDisplayUrl(activeBlog)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Address copied' : 'Copy address'}
            title="Copy address"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            {copied ? <CheckCircle2 size={15} className="text-green-500" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          </button>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open your blog in a new tab"
            title="Open your blog"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-violet-600 dark:hover:bg-zinc-700 dark:hover:text-violet-400"
          >
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <p className={`mt-1.5 ${hintClass}`}>
          Your Inko address, <strong className="font-semibold">{subdomain}.inko.blog</strong>, always works and can't be changed.
        </p>
      </div>

      <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
        {isPaid ? (
          <>
            <Field
              label="Custom domain"
              error={domainError}
              hint={
                <>
                  At your DNS provider, add a <strong className="font-semibold">CNAME</strong> record pointing to{' '}
                  <code className="font-mono">{subdomain}.inko.blog</code>, then connect it here.
                </>
              }
            >
              {(control) => (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    {...control}
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    // Enter here connects the domain, rather than saving the rest of the page.
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      if (canConnect && !saving) saveDomain(domain);
                    }}
                    placeholder="blog.yoursite.com"
                    className={`${inputClass} flex-1 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => saveDomain(domain)}
                    disabled={!canConnect || !!saving}
                    className={primaryButtonClass}
                  >
                    {saving === 'connect' && <Loader2 className="animate-spin" size={15} aria-hidden="true" />}
                    {currentDomain ? 'Update domain' : 'Connect domain'}
                  </button>
                  {removeButton}
                </div>
              )}
            </Field>
          </>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className={labelClass}>Custom domain</p>
              <PaidFeatureBadge />
            </div>
            {currentDomain ? (
              // Connected on a paid plan before a downgrade: it keeps working and
              // can be removed, but changing it needs Pro or Team again.
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-semibold text-zinc-900 dark:text-white">{currentDomain}</p>
                  <p className={`mt-0.5 ${hintClass}`}>Still connected. Upgrade to Pro to change it.</p>
                </div>
                {removeButton}
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">Use your own domain, like blog.yoursite.com.</p>
                <Link to={toWorkspace('/settings/billing')} className={primaryButtonClass}>
                  <Zap size={15} aria-hidden="true" /> Upgrade to Pro
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  );
};
