import React from 'react';
import { Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import api from '../api/blogApi';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAboutPreviewDraft } from '../hooks/useAboutPreviewDraft';
import { useBlogStats } from '../hooks/useBlogStats';
import { useSiteName, useSiteSettings } from '../hooks/useSiteSettings';
import { getActiveSocialLinks } from '../utils/social';

// The bio is owner-written Markdown, rendered without raw HTML — so neither
// saved settings nor a preview draft can inject markup or script. `#` is
// demoted because the page already has its <h1>.
const bioComponents: Components = {
  h1: ({ children }) => <h2>{children}</h2>,
};

export const About: React.FC = () => {
  usePageMeta('About');

  // Blog-wide totals from the server — counting a fetched page of posts
  // would stop growing once the blog outgrew that page.
  const { stats: postStats } = useBlogStats();

  // Unset bio fields fall back to the blog's own name and tagline, never to
  // invented platform copy.
  const { data: siteSettings } = useSiteSettings();
  const siteName = useSiteName();
  const siteTagline = siteSettings?.general?.site_tagline;

  // Fetch site settings (for customizable About page content)
  const { data: settings } = useQuery({
    queryKey: ['siteSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/about');
        return res.data;
      } catch {
        // Neutral fallback if the fetch fails: no invented bio text, and no
        // placeholder email that would render as a real contact link.
        return {
          bio_title: "",
          bio_subtitle: "",
          bio_content: "",
          show_stats: true,
          show_contact_cta: true,
          email: null,
          social_links: {},
        };
      }
    }
  });

  // Only ever set by the admin studio's Preview button (see the hook).
  const previewDraft = useAboutPreviewDraft();

  const stats = {
    articles: postStats?.articles ?? 0,
    views: postStats?.views ?? 0,
    projects: postStats?.projects ?? 0,
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const statItems = [
    { label: 'Articles published', value: String(stats.articles) },
    { label: 'Total views', value: formatNumber(stats.views) },
    ...(stats.projects > 0 ? [{ label: 'Projects', value: String(stats.projects) }] : []),
  ];

  // Use settings data or defaults
  const effectiveSettings = previewDraft || settings || {};

  const {
    bio_title,
    bio_subtitle,
    bio_content,
    show_stats,
    show_contact_cta,
    email,
    social_links
  } = effectiveSettings;

  const socialLinks = getActiveSocialLinks(social_links);

  return (
    <div>

      {/* Hero Section */}
      <div className="bg-zinc-50 border-b border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center">
            {previewDraft && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4 border border-primary/30 text-sm font-bold">
                Previewing unsaved changes
              </div>
            )}
            
            
            <h1 className="text-4xl md:text-6xl font-black text-zinc-900 dark:text-zinc-50 mb-6 leading-tight">
              {bio_title || siteName || 'About'}
            </h1>

            {(bio_subtitle || siteTagline) && (
              <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                {bio_subtitle || siteTagline}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Stats — hidden until the blog has published something, so a new
            blog doesn't open with a row of zeros. Projects only when there are some. */}
        {show_stats !== false && stats.articles > 0 && (
          <div className={`grid gap-4 sm:gap-6 mb-20 ${stats.projects > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {statItems.map((item) => (
              <div key={item.label} className="card text-center p-6">
                <div className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-50 mb-2">
                  {item.value}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bio Content — omitted rather than filled with platform boilerplate */}
        {bio_content && (
          <div className="mb-20">
            <div className="prose prose-lg prose-zinc dark:prose-invert max-w-none prose-a:text-primary dark:prose-a:text-zinc-50 dark:prose-a:decoration-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={bioComponents}>
                {bio_content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* CTA - Only show if enabled */}
        {show_contact_cta !== false && (
          <div className="bg-zinc-800 rounded-2xl p-8 sm:p-12 text-center text-white dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <h2 className="text-3xl font-bold mb-4">Let's connect</h2>
            <p className="text-zinc-300 mb-8 max-w-xl mx-auto text-lg">
              Questions, feedback or ideas — send a message.
            </p>

            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              <Send size={18} aria-hidden="true" />
              Send a message
            </Link>

            {email && (
              <p className="mt-4 text-sm text-zinc-300">
                or email{' '}
                <a href={`mailto:${email}`} className="font-semibold text-white underline underline-offset-2 hover:no-underline break-all">
                  {email}
                </a>
              </p>
            )}

            {/* Social Links - Only show if configured */}
            {socialLinks.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                {socialLinks.map(({ key, url, label, icon: Icon }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (opens in new tab)`}
                    className="p-3 bg-white/15 rounded-xl hover:bg-white/25 transition-colors"
                  >
                    <Icon size={22} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
