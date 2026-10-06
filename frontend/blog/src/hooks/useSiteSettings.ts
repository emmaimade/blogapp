import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import { useTenant } from '../contexts/TenantContext';

/** How post lists render on the public blog — chosen in the admin's Appearance settings. */
export type PostLayout = 'feed' | 'cards' | 'compact';

const POST_LAYOUTS: readonly PostLayout[] = ['feed', 'cards', 'compact'];
const DEFAULT_HOME_LAYOUT: PostLayout = 'feed';
const DEFAULT_ARCHIVE_LAYOUT: PostLayout = 'compact';

const toPostLayout = (value: unknown, fallback: PostLayout): PostLayout =>
  POST_LAYOUTS.includes(value as PostLayout) ? (value as PostLayout) : fallback;

// Fallbacks for a failed/slow settings fetch. Tenant-neutral on purpose: a
// tenant's blog must never show up branded as the platform. The site name
// comes from the resolved tenant itself (see useSiteSettings below).
const buildDefaultSiteSettings = (siteName: string) => ({
  general: {
    site_name: siteName,
    site_tagline: '',
    site_description: '',
    timezone: 'UTC',
    language: 'en',
    posts_per_page: 10,
  },
  about: {
    bio_title: 'Welcome to My Blog',
    bio_subtitle: 'Sharing ideas, stories, and insights',
    bio_content: '',
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
    footer_text: '',
    show_social_links: true,
    social_links: {
      github: null,
      twitter: null,
      linkedin: null,
      instagram: null,
      youtube: null,
      facebook: null,
    },
    copyright_text: `© {year} ${siteName}. All rights reserved.`,
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
    home_layout: DEFAULT_HOME_LAYOUT,
    archive_layout: DEFAULT_ARCHIVE_LAYOUT,
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
});

export const useSiteSettings = () => {
  const { blog } = useTenant();
  const defaultSiteSettings = buildDefaultSiteSettings(blog?.name ?? '');

  return useQuery({
    queryKey: ['allSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/public');
        return res.data;
      } catch {
        return defaultSiteSettings;
      }
    },
    // placeholderData (not initialData) so this still triggers a real fetch
    // on first mount — initialData marks the query as already-fetched, which
    // combined with staleTime below meant the real request never fired and
    // Navbar/Footer were stuck on these defaults for the first 5 minutes.
    placeholderData: defaultSiteSettings,
    // Branding/copy rarely changes mid-session — avoid refetching on every
    // Navbar/Footer remount across client-side navigations.
    staleTime: 5 * 60 * 1000,
  });
};

/** The tenant's display name: its configured site name, else the blog's own name. */
export const useSiteName = (): string => {
  const { blog } = useTenant();
  const { data } = useSiteSettings();
  return data?.general?.site_name || blog?.name || '';
};

/** The owner's chosen post layouts for the home page and `/blog`, with safe defaults. */
export const usePostLayouts = (): { homeLayout: PostLayout; archiveLayout: PostLayout } => {
  const { data } = useSiteSettings();
  return {
    homeLayout: toPostLayout(data?.branding?.home_layout, DEFAULT_HOME_LAYOUT),
    archiveLayout: toPostLayout(data?.branding?.archive_layout, DEFAULT_ARCHIVE_LAYOUT),
  };
};
