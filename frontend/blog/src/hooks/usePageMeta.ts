import { useEffect } from 'react';
import { useSiteName, useSiteSettings } from './useSiteSettings';
import { applyPageMeta } from '../utils/seo';

/**
 * Sets this page's title/description/OG tags, prefixed with the tenant's own
 * brand (not the platform's) — each page owns its own tags, so nothing here should
 * be duplicated in App.tsx's site-wide effect.
 */
export const usePageMeta = (title: string, description?: string, ogImage?: string) => {
  const { data: siteSettings } = useSiteSettings();
  const siteName = useSiteName();

  useEffect(() => {
    const fallbackDescription =
      siteSettings?.seo?.meta_description ||
      siteSettings?.general?.site_description ||
      '';

    applyPageMeta({
      // No trailing "·" while the tenant's name is still unknown.
      title: siteName ? `${title} · ${siteName}` : title,
      description: description || fallbackDescription,
      ogImage: ogImage || siteSettings?.seo?.og_image,
    });
  }, [title, description, ogImage, siteSettings, siteName]);
};
