import React, { useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, ImageIcon, Loader2, Search, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { getBlogDisplayUrl } from '../../../shared/lib/blogUrl';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import { Field, hintClass, inputClass, labelClass, secondaryButtonClass } from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';

interface SEOSettingsData {
  meta_title: string;
  meta_description: string;
  google_analytics_id: string;
  google_site_verification: string;
  og_image: string;
  twitter_handle: string;
  // meta_keywords and anything else the API sends go back unchanged.
  [other: string]: unknown;
}

const TEXT_FIELDS = ['meta_title', 'meta_description', 'google_analytics_id', 'google_site_verification', 'og_image', 'twitter_handle'] as const;

const TITLE_LENGTH = 60;
const DESCRIPTION_LENGTH = 160;

const GA4_ID = /^G-[A-Z0-9]{4,}$/;
const analyticsError = (value: string) =>
  value.trim() && !GA4_ID.test(value.trim().toUpperCase()) ? 'A Measurement ID looks like G-XXXXXXXXXX.' : null;

/** Accepts the code itself, or the whole <meta … content="…"> tag Search Console shows. */
const verificationCode = (value: string) => value.match(/content=["']([^"']+)["']/)?.[1] ?? value.trim();

const truncate = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

export const SEOSettings: React.FC = () => {
  useDocumentTitle('SEO settings');
  const { activeBlog } = useBlog();
  const blogId = activeBlog?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useSettingsForm<SEOSettingsData>({
    queryKey: ['seoSettings', blogId],
    empty: Object.fromEntries(TEXT_FIELDS.map((field) => [field, ''])) as SEOSettingsData,
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/seo`)).data ?? {};
      return { ...data, ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, data[field] ?? ''])) } as SEOSettingsData;
    },
    validate: (values) => analyticsError(values.google_analytics_id) && 'Check the Google Analytics Measurement ID.',
    save: (values) =>
      api.post(`/blogs/${blogId}/settings/seo`, {
        ...values,
        ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, values[field].trim() || null])),
        google_analytics_id: values.google_analytics_id.trim().toUpperCase() || null,
        google_site_verification: verificationCode(values.google_site_verification) || null,
        twitter_handle: values.twitter_handle.trim().replace(/^@/, '') || null,
      }),
    invalidate: [['allSettings']],
    successMessage: 'SEO settings saved',
    errorMessage: "Couldn't save SEO settings",
  });

  // What the blog's home page falls back to when the fields here are blank.
  const { data: general } = useQuery({
    queryKey: ['generalSettingsForSeo', blogId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/settings/general`)).data,
    enabled: !!blogId,
  });
  const siteName = general?.site_name || activeBlog?.name || '';
  const siteTagline = general?.site_tagline || activeBlog?.tagline || '';
  const defaultTitle = siteTagline ? `${siteName} - ${siteTagline}` : siteName;
  const defaultDescription = general?.site_description || activeBlog?.description || '';

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post(`/blogs/${blogId}/settings/seo/upload-og-image`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.url as string;
    },
    onSuccess: (url) => {
      form.update('og_image', url);
      toast.success('Image uploaded — save to use it');
    },
    onError: (error) => toastApiError(error, "Couldn't upload the image"),
  });

  const { values, update } = form;
  const previewTitle = values.meta_title.trim() || defaultTitle;
  const previewDescription = values.meta_description.trim() || defaultDescription;

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load SEO settings" skeletonCards={3}>
      <SettingsCard title="Search results" icon={Search} description="How your home page appears on Google and other search engines.">
        <Field
          label="Title"
          hint={`Leave blank to use "${defaultTitle}". Around ${TITLE_LENGTH} characters fit before Google cuts it off.`}
          count={{ length: values.meta_title.length, recommended: TITLE_LENGTH }}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.meta_title}
              onChange={(e) => update('meta_title', e.target.value)}
              placeholder={defaultTitle}
              className={inputClass}
            />
          )}
        </Field>
        <Field
          label="Description"
          hint={`Around ${DESCRIPTION_LENGTH} characters fit. Leave blank to use your blog's description.`}
          count={{ length: values.meta_description.length, recommended: DESCRIPTION_LENGTH }}
        >
          {(control) => (
            <textarea
              {...control}
              value={values.meta_description}
              onChange={(e) => update('meta_description', e.target.value)}
              placeholder={defaultDescription || 'What readers will find on your blog, in a sentence or two.'}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          )}
        </Field>

        <div>
          <p className={`mb-1.5 ${labelClass}`}>Preview</p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
            <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{activeBlog ? getBlogDisplayUrl(activeBlog) : ''}</p>
            <p className="mt-1 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
              {truncate(previewTitle || 'Your blog', TITLE_LENGTH)}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {previewDescription ? truncate(previewDescription, DESCRIPTION_LENGTH) : 'Add a description so search engines show something useful here.'}
            </p>
          </div>
          <p className={`mt-1.5 ${hintClass}`}>An approximation — search engines decide the final layout.</p>
        </div>
      </SettingsCard>

      <SettingsCard title="Social sharing" icon={ImageIcon} description="What shows when someone shares a link to your blog.">
        <div>
          <p className={`mb-1.5 ${labelClass}`}>Share image</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex aspect-[1200/630] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 sm:w-64">
              {values.og_image ? (
                <img src={values.og_image} alt="Share image preview" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={28} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-3">
              <p className={hintClass}>Shown on Facebook, LinkedIn, X and in chat apps. 1200×630 pixels works best; PNG, JPEG or WebP.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={upload.isPending}
                  className={secondaryButtonClass}
                >
                  {upload.isPending ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
                  {values.og_image ? 'Replace image' : 'Upload image'}
                </button>
                {values.og_image && (
                  <button
                    type="button"
                    onClick={() => update('og_image', '')}
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>

        <Field label="X (Twitter) handle" hint="Credits you on cards when your posts are shared on X.">
          {(control) => (
            <div className="flex items-center rounded-xl">
              <span className="pr-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400" aria-hidden="true">
                @
              </span>
              <input
                {...control}
                type="text"
                autoCapitalize="none"
                spellCheck={false}
                value={values.twitter_handle}
                onChange={(e) => update('twitter_handle', e.target.value.replace(/^@/, ''))}
                placeholder="username"
                className={inputClass}
              />
            </div>
          )}
        </Field>
      </SettingsCard>

      <SettingsCard title="Analytics and verification" icon={BarChart3} description="Connect Google's tools to your blog.">
        <Field
          label="Google Analytics Measurement ID"
          hint="In Google Analytics: Admin → Data streams → your stream. Your blog starts sending visits once you save."
          error={analyticsError(values.google_analytics_id)}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              autoCapitalize="characters"
              spellCheck={false}
              value={values.google_analytics_id}
              onChange={(e) => update('google_analytics_id', e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className={`${inputClass} font-mono`}
            />
          )}
        </Field>
        <Field
          label="Google Search Console verification"
          hint='Choose the "HTML tag" method and paste the tag or just its code.'
        >
          {(control) => (
            <input
              {...control}
              type="text"
              autoCapitalize="none"
              spellCheck={false}
              value={values.google_site_verification}
              onChange={(e) => update('google_site_verification', e.target.value)}
              placeholder="abc123def456…"
              className={`${inputClass} font-mono`}
            />
          )}
        </Field>
      </SettingsCard>
    </SettingsForm>
  );
};
