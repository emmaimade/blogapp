import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Instagram, Youtube, Facebook } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import { useSiteSettings } from '../hooks/useSiteSettings';

const POWERED_BY_INKO = 'Powered by INKO';

export const Footer: React.FC = () => {
  const { data: siteSettings } = useSiteSettings();
  const general = siteSettings?.general;
  const branding = siteSettings?.branding;
  const settings = siteSettings?.footer;
  const siteName = general?.site_name || 'Inko';
  const logoUrl = branding?.logo_url;
  const primaryColor = branding?.primary_color || '#9333EA';

  const { data: popularTags } = useQuery({
    queryKey: ['popularTags'],
    queryFn: async () => {
      const res = await api.get('/tags/popular?limit=4');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const socialLinks = settings?.social_links || {};
  const footerSocials = [
    { key: 'github', href: socialLinks.github, icon: Github, label: 'GitHub' },
    { key: 'twitter', href: socialLinks.twitter, icon: Twitter, label: 'Twitter' },
    { key: 'linkedin', href: socialLinks.linkedin, icon: Linkedin, label: 'LinkedIn' },
    { key: 'instagram', href: socialLinks.instagram, icon: Instagram, label: 'Instagram' },
    { key: 'youtube', href: socialLinks.youtube, icon: Youtube, label: 'YouTube' },
    { key: 'facebook', href: socialLinks.facebook, icon: Facebook, label: 'Facebook' },
  ].filter((item) => Boolean(item.href));

  const showTags = settings?.show_categories !== false && popularTags?.length > 0;
  const showSocials = settings?.show_social_links !== false && footerSocials.length > 0;

  // The backend's default copyright text embeds "Powered by INKO" as plain
  // wording (paid plans can edit it away). Render that phrase as the real
  // attribution link when present, instead of showing it twice.
  const currentYear = new Date().getFullYear();
  const copyrightText = String(settings?.copyright_text || POWERED_BY_INKO).replace(
    '{year}',
    String(currentYear),
  );
  const poweredByIndex = copyrightText.indexOf(POWERED_BY_INKO);

  return (
    <footer className="bg-white border-t border-zinc-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-xl font-black shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
              ) : (
                <span style={{ fontFamily: 'var(--font-heading)' }}>
                  {siteName}<span style={{ color: primaryColor }}>.</span>
                </span>
              )}
            </Link>
            {settings?.footer_text && (
              <span className="text-zinc-500 text-sm truncate hidden sm:inline">
                {settings.footer_text}
              </span>
            )}
          </div>

          <div className="text-sm text-zinc-500">
            {poweredByIndex === -1 ? (
              copyrightText
            ) : (
              <>
                {copyrightText.slice(0, poweredByIndex)}
                <a
                  href={import.meta.env.VITE_MARKETING_SITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-900 transition-colors"
                >
                  {POWERED_BY_INKO}
                </a>
                {copyrightText.slice(poweredByIndex + POWERED_BY_INKO.length)}
              </>
            )}
          </div>
        </div>

        {(showTags || showSocials) && (
          <div className="border-t border-zinc-100 mt-6 pt-4 flex items-center gap-4 flex-wrap">
            {showTags && (
              <div className="flex items-center gap-3 flex-wrap">
                {popularTags.map((tag: { id: number; name: string }) => (
                  <Link
                    key={tag.id}
                    to={`/tag/${tag.name}`}
                    className="text-xs text-zinc-500 hover:text-primary transition-colors"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}

            {showTags && showSocials && (
              <div className="h-4 w-px bg-zinc-200" aria-hidden="true" />
            )}

            {showSocials && (
              <div className="flex gap-2">
                {footerSocials.map(({ key, href, icon: Icon, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-all text-zinc-700 hover:text-zinc-900"
                    aria-label={label}
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};
