import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Github, Twitter, Linkedin, Instagram, Youtube, Facebook } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import { useSiteSettings } from '../hooks/useSiteSettings';

export const Footer: React.FC = () => {
  const { data: siteSettings } = useSiteSettings();
  const general = siteSettings?.general;
  const branding = siteSettings?.branding;
  const siteName = general?.site_name || 'Inko';
  const logoUrl = branding?.logo_url;
  const primaryColor = branding?.primary_color || '#9333EA';

  const { data: settings } = useQuery({
    queryKey: ['footerSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/footer');
        return res.data;
      } catch (error) {
        return {
          footer_text: 'Your ideas, amplified.',
          show_newsletter: true,
          newsletter_title: 'Newsletter',
          newsletter_description: 'Get the latest posts delivered to your inbox.',
          show_social_links: true,
          social_links: {
            github: '',
            twitter: '',
            linkedin: '',
            instagram: '',
            youtube: '',
            facebook: '',
          },
          copyright_text: 'Powered by INKO',
          show_quick_links: true,
          show_categories: true,
        };
      }
    }
  });

  const { data: popularTags } = useQuery({
    queryKey: ['popularTags'],
    queryFn: async () => {
      const res = await api.get('/tags/popular?limit=4');
      return res.data;
    }
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

  return (
    <footer className="bg-white border-t border-zinc-200 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="text-2xl font-black mb-4 block">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={siteName}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <span style={{ fontFamily: 'var(--font-heading)' }}>
                  {siteName}<span style={{ color: primaryColor }}>.</span>
                </span>
              )}
            </Link>
            <p className="text-zinc-600 text-sm mb-4">
              {settings?.footer_text || 'Your ideas, amplified.'}
            </p>
            {settings?.show_social_links !== false && footerSocials.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {footerSocials.map(({ key, href, icon: Icon, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-all text-zinc-700 hover:text-zinc-900"
                    aria-label={label}
                  >
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {settings?.show_quick_links !== false && (
            <div>
              <h3 className="font-bold text-lg text-zinc-900 mb-4">Quick Links</h3>
              <ul className="space-y-2 text-zinc-600">
                <li>
                  <Link to="/" className="hover:text-zinc-900 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-zinc-900 transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-zinc-900 transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-zinc-900 transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {settings?.show_categories !== false && (
            <div>
              <h3 className="font-bold text-lg text-zinc-900 mb-4">Popular Topics</h3>
              <ul className="space-y-2 text-zinc-600">
                {popularTags?.length > 0 ? (
                  popularTags.map((tag: { id: number; name: string }) => (
                    <li key={tag.id}>
                      <Link
                        to={`/blog?tag=${tag.name}`}
                        className="hover:text-zinc-900 transition-colors"
                      >
                        {tag.name}
                      </Link>
                    </li>
                  ))
                ) : (
                  <>
                    <li>
                      <Link to="/blog" className="hover:text-zinc-900 transition-colors">
                        All Articles
                      </Link>
                    </li>
                    <li>
                      <Link to="/blog?filter=projects" className="hover:text-zinc-900 transition-colors">
                        Projects
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}

          {settings?.show_newsletter !== false && (
            <div>
              <h3 className="font-bold text-lg text-zinc-900 mb-4">
                {settings?.newsletter_title || 'Newsletter'}
              </h3>
              <p className="text-zinc-600 text-sm mb-4">
                {settings?.newsletter_description || 'Get the latest posts delivered to your inbox.'}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-4 py-2 rounded-lg bg-zinc-50 border border-zinc-200 outline-none focus:border-purple-600 focus:bg-white transition-all text-sm"
                />
                <button
                  className="bg-zinc-100 px-4 py-2 rounded-lg hover:bg-zinc-200 transition-all text-zinc-700 hover:text-zinc-900"
                  aria-label="Subscribe"
                >
                  <Mail size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-600">
          <a 
            href={import.meta.env.VITE_MARKETING_SITE_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-zinc-500 text-xs hover:text-zinc-900 transition-colors"
          >
            Powered by INKO
          </a>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-zinc-900 transition-colors">
              Terms
            </Link>
            <Link to="/sitemap" className="hover:text-zinc-900 transition-colors">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
