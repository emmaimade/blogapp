import React from 'react';
import { Eye, BookOpen, Megaphone, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import { Field, SwitchRow, inputClass, secondaryButtonClass } from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';

interface AboutSettingsData {
  bio_title: string;
  bio_subtitle: string;
  bio_content: string;
  show_stats: boolean;
  show_contact_cta: boolean;
  show_social_links: boolean;
  email: string;
  /** Edited under Social profiles; sent back as received. */
  social_links: Record<string, string | null>;
}

// What the platform used to save as every blog's story. Treated as no story,
// so it's never published by accident.
const LEGACY_BIO = 'This is a modern blog CMS. Customize this in your admin panel.';

export const AboutPageSettings: React.FC = () => {
  useDocumentTitle('About page settings');
  const { activeBlog } = useBlog();
  const toWorkspace = useWorkspacePath();
  const blogId = activeBlog?.id;

  const publicSiteOrigin =
    import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (window.location.hostname === 'localhost' && window.location.port === '5173'
      ? `${window.location.protocol}//${window.location.hostname}:5174`
      : window.location.origin);
  const previewUrl = `${publicSiteOrigin}/about`;

  const form = useSettingsForm<AboutSettingsData>({
    queryKey: ['aboutSettings', blogId],
    empty: {
      bio_title: '',
      bio_subtitle: '',
      bio_content: '',
      show_stats: true,
      show_contact_cta: true,
      show_social_links: true,
      email: '',
      social_links: {},
    },
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/about`)).data ?? {};
      return {
        bio_title: data.bio_title ?? '',
        bio_subtitle: data.bio_subtitle ?? '',
        bio_content: data.bio_content && data.bio_content !== LEGACY_BIO ? data.bio_content : '',
        show_stats: data.show_stats ?? true,
        show_contact_cta: data.show_contact_cta ?? true,
        show_social_links: data.show_social_links ?? true,
        email: data.email ?? '',
        social_links: data.social_links ?? {},
      };
    },
    save: (values) => api.post(`/blogs/${blogId}/settings/about`, { ...values, email: values.email.trim() || null }),
    invalidate: [['siteSettings']],
    successMessage: 'About page saved',
    errorMessage: "Couldn't save the About page",
  });

  const { values, update } = form;

  // The draft goes to the preview tab over postMessage, never in the URL —
  // a URL-borne draft let anyone make a blog's About page show any content.
  // Handshake (mirrored in the blog's useAboutPreviewDraft): the tab opens
  // `/about?preview=1`, says it's ready, and only then gets the draft, sent
  // pinned to the blog's origin. No `noopener`, since the tab needs
  // window.opener to reach back here.
  const handlePreview = () => {
    const draft = { ...values };
    const url = new URL(previewUrl);
    url.searchParams.set('preview', '1');
    const blogOrigin = url.origin;

    const previewWindow = window.open(url.toString(), '_blank');
    if (!previewWindow) {
      toast.error('Allow pop-ups for this site to preview your changes.');
      return;
    }

    const handleReady = (event: MessageEvent) => {
      if (event.origin !== blogOrigin || event.source !== previewWindow) return;
      if (event.data?.type !== 'inko:about-preview-ready') return;
      previewWindow.postMessage({ type: 'inko:about-preview-draft', draft }, blogOrigin);
    };
    window.addEventListener('message', handleReady);
    // The tab announces itself within seconds of loading; don't listen forever.
    window.setTimeout(() => window.removeEventListener('message', handleReady), 60_000);
  };

  const toolbar = (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        See your About page as readers will, including changes you haven't saved.
      </p>
      <button type="button" onClick={handlePreview} className={secondaryButtonClass}>
        <Eye size={15} aria-hidden="true" /> Preview
      </button>
    </div>
  );

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load the About page" skeletonCards={4} toolbar={toolbar}>
      <SettingsCard title="Heading" icon={Sparkles} description="The first thing readers see on your About page.">
        <Field label="Title" hint="Leave blank to use your blog name.">
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.bio_title}
              onChange={(e) => update('bio_title', e.target.value)}
              placeholder={activeBlog?.name ?? 'About'}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Subtitle" hint="A short line under the title. Leave blank to use your tagline.">
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.bio_subtitle}
              onChange={(e) => update('bio_subtitle', e.target.value)}
              placeholder={activeBlog?.tagline || 'Sharing ideas, stories, and insights'}
              className={inputClass}
            />
          )}
        </Field>
      </SettingsCard>

      <SettingsCard title="Your story" icon={BookOpen} description="Who you are, what you write about, and why readers should follow along.">
        <Field
          label="Story"
          hint={
            <>
              Supports Markdown: <code className="font-mono">**bold**</code>, <code className="font-mono">_italic_</code>,{' '}
              <code className="font-mono">[links](https://…)</code> and lists. Left blank, this section is hidden.
            </>
          }
        >
          {(control) => (
            <textarea
              {...control}
              value={values.bio_content}
              onChange={(e) => update('bio_content', e.target.value)}
              rows={12}
              placeholder="I started this blog to…"
              className={`${inputClass} resize-y leading-relaxed`}
            />
          )}
        </Field>
      </SettingsCard>

      <SettingsCard title="Stats" icon={SlidersHorizontal} description="How many posts you've published and their total views.">
        <SwitchRow
          label="Show stats"
          description="Hidden until you publish your first post, either way."
          checked={values.show_stats}
          onChange={(checked) => update('show_stats', checked)}
        />
      </SettingsCard>

      <SettingsCard
        title="Let's connect"
        icon={Megaphone}
        description="A section at the end of the page with a button to your Contact page."
        toggle={{ checked: values.show_contact_cta, onChange: (checked) => update('show_contact_cta', checked), label: 'Show' }}
      >
        {values.show_contact_cta && (
          <>
            <Field label="Email" hint={'Shown under the button as "or email …". Leave blank to show only the button.'}>
              {(control) => (
                <input
                  {...control}
                  type="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={values.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="hello@example.com"
                  className={inputClass}
                />
              )}
            </Field>
            <SwitchRow
              label="Social links"
              description={
                <>
                  Your links from{' '}
                  <Link to={toWorkspace('/settings/social')} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                    Social profiles
                  </Link>
                  , under the email.
                </>
              }
              checked={values.show_social_links}
              onChange={(checked) => update('show_social_links', checked)}
            />
          </>
        )}
      </SettingsCard>
    </SettingsForm>
  );
};
