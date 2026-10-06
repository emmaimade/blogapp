import { useEffect } from 'react';

const BRAND = 'Inko';

const upsertMetaTag = (name: string, content: string) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

/**
 * Sets the browser tab title (and meta description, when given) for the page it's called from.
 * Titles read "{title} · Inko" so the page name survives tab truncation; pass `brandFirst`
 * on the home page to get "Inko · {title}" instead.
 */
export const usePageMeta = (title: string, description?: string, { brandFirst = false } = {}) => {
  useEffect(() => {
    document.title = brandFirst ? `${BRAND} · ${title}` : `${title} · ${BRAND}`;
    if (description) {
      upsertMetaTag('description', description);
    }
  }, [title, description, brandFirst]);
};
