import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';

const defaultSiteSettings = {
  general: {
    site_name: 'Inko',
    site_tagline: 'Your ideas, amplified',
    site_description: 'A modern blog CMS for sharing your stories and ideas',
    timezone: 'UTC',
    language: 'en',
    posts_per_page: 10,
  },
  about: {
    bio_title: 'Welcome to My Blog',
    bio_subtitle: 'Sharing ideas, stories, and insights',
    bio_content: 'This is a modern blog CMS. Customize this in your admin panel.',
    show_stats: true,
    show_contact_cta: true,
    email: null,
    social_links: {
      github: null,
      twitter: null,
      linkedin: null,
      instagram: null,
      youtube: null,
      facebook: null,
    },
  },
  footer: {
    footer_text: 'Your ideas, amplified.',
    show_newsletter: true,
    newsletter_title: 'Newsletter',
    newsletter_description: 'Get the latest posts delivered to your inbox.',
    show_social_links: true,
    social_links: {
      github: null,
      twitter: null,
      linkedin: null,
      instagram: null,
      youtube: null,
      facebook: null,
    },
    copyright_text: '© {year} Inko. All rights reserved.',
    show_quick_links: true,
    show_categories: true,
  },
  branding: {
    primary_color: '#9333EA',
    secondary_color: '#18181B',
    accent_color: '#A855F7',
    logo_url: null,
    favicon_url: null,
    font_heading: 'Inter',
    font_body: 'Inter',
  },
  seo: {
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
    google_analytics_id: '',
    google_site_verification: '',
    og_image: '',
    twitter_handle: '',
  },
};

export const useSiteSettings = () =>
  useQuery({
    queryKey: ['allSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/all');
        return res.data;
      } catch (error) {
        return defaultSiteSettings;
      }
    },
    initialData: defaultSiteSettings,
  });
