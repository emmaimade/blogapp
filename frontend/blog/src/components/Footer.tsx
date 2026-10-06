import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import { useSiteName, useSiteSettings } from '../hooks/useSiteSettings';
import { useTenant } from '../contexts/TenantContext';
import { getActiveSocialLinks } from '../utils/social';
import { tagUrl } from '../utils/posts';

const POWERED_BY_INKO = 'Powered by INKO';
const MARKETING_SITE_URL = import.meta.env.VITE_MARKETING_SITE_URL;

const footerNavLinks = [
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const columnHeadingClass =
  'text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 mb-3';

export const Footer: React.FC = () => {
  const { data: siteSettings } = useSiteSettings();
  const branding = siteSettings?.branding;
  const settings = siteSettings?.footer;
  const siteName = useSiteName();
  const logoUrl = branding?.logo_url;
  const { blog } = useTenant();

  const tagsEnabled = settings?.show_categories !== false;
  const { data: popularTags, isPending: tagsPending } = useQuery({
    queryKey: ['popularTags', blog?.id],
    queryFn: async () => {
      const res = await api.get('/tags/popular?limit=6');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: tagsEnabled,
  });

  const footerSocials = getActiveSocialLinks(settings?.social_links);

  // Keep the Topics column mounted while tags load so the grid doesn't
  // reflow when they arrive; drop it only once we know there are none.
  const showTags = tagsEnabled && (tagsPending || popularTags?.length > 0);
  const showSocials = settings?.show_social_links !== false && footerSocials.length > 0;

  // The backend's default copyright text embeds "Powered by INKO" as plain
  // wording (paid plans can edit it away). Pull that phrase out into the
  // bottom bar's attribution slot instead of showing it twice.
  const currentYear = new Date().getFullYear();
  const copyrightText = String(settings?.copyright_text || '').replace('{year}', String(currentYear));
  const showPoweredBy = !settings?.copyright_text || copyrightText.includes(POWERED_BY_INKO);
  // "© 2026 Name. Powered by INKO." -> "© 2026 Name."
  const copyrightOnly = copyrightText
    .replace(/\s*[·|•–—-]?\s*Powered by INKO\.?/, '')
    .replace(/^\s*[·|•–—-]\s*/, '')
    .trim();

  return (
    <footer className="bg-white border-t border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-6 lg:col-span-5">
            <Link to="/" className="inline-block text-xl font-black">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
              ) : (
                <span className="text-zinc-900 dark:text-zinc-50" style={{ fontFamily: 'var(--font-heading)' }}>
                  {siteName}<span className="text-primary">.</span>
                </span>
              )}
            </Link>
            {settings?.footer_text && (
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {settings.footer_text}
              </p>
            )}
            {showSocials && (
              <ul className="mt-5 -ml-2.5 flex flex-wrap gap-1">
                {footerSocials.map(({ key, url, icon: Icon, label }) => (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:text-primary hover:bg-zinc-100 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800"
                      aria-label={`${label} (opens in new tab)`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Explore */}
          {/* Without Topics, pin Explore to the right edge so the row stays balanced. */}
          <nav
            aria-labelledby="footer-explore"
            className={showTags ? 'md:col-span-2 lg:col-span-3' : 'md:col-span-2 md:col-start-11'}
          >
            <h2 id="footer-explore" className={columnHeadingClass}>
              Explore
            </h2>
            <ul className="-my-1.5">
              {footerNavLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="inline-block py-1.5 text-sm text-zinc-600 hover:text-primary transition-colors dark:text-zinc-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Topics */}
          {showTags && (
            <nav aria-labelledby="footer-topics" className="md:col-span-4">
              <h2 id="footer-topics" className={columnHeadingClass}>
                Topics
              </h2>
              <ul className="flex flex-wrap gap-2 min-h-18 content-start">
                {popularTags?.map((tag: { id: number; name: string }) => (
                  <li key={tag.id}>
                    <Link
                      to={tagUrl(tag.name)}
                      className="inline-block rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-primary hover:text-primary transition-colors dark:border-zinc-700 dark:text-zinc-400"
                    >
                      #{tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-zinc-100 flex flex-col gap-2 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:text-zinc-400">
          <p>{copyrightOnly || `© ${currentYear} ${siteName}`}</p>
          {showPoweredBy &&
            (MARKETING_SITE_URL ? (
              <a
                href={MARKETING_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
              >
                {POWERED_BY_INKO}
              </a>
            ) : (
              <span>{POWERED_BY_INKO}</span>
            ))}
        </div>
      </div>
    </footer>
  );
};
