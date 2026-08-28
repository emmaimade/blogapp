export const upsertHeadElement = (
  selector: string,
  tagName: 'meta' | 'link',
  attributes: Record<string, string>
) => {
  let element = document.head.querySelector(selector) as HTMLElement | null;

  if (!element) {
    element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key !== 'content' && key !== 'href') {
        element!.setAttribute(key, value);
      }
    });
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });
};

export interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
}

const readMetaContent = (selector: string): string =>
  document.head.querySelector(selector)?.getAttribute('content') || '';

/** Snapshot of the currently-applied page meta, so a route can restore it on unmount. */
export const captureCurrentMeta = (): PageMeta => ({
  title: document.title,
  description: readMetaContent('meta[name="description"]'),
  ogImage: readMetaContent('meta[property="og:image"]'),
});

/** Overrides title/description/OG/Twitter tags for the current route. */
export const applyPageMeta = ({ title, description, ogImage }: PageMeta) => {
  document.title = title;
  upsertHeadElement('meta[name="title"]', 'meta', { name: 'title', content: title });
  upsertHeadElement('meta[name="description"]', 'meta', { name: 'description', content: description });
  upsertHeadElement('meta[property="og:title"]', 'meta', { property: 'og:title', content: title });
  upsertHeadElement('meta[property="og:description"]', 'meta', { property: 'og:description', content: description });
  upsertHeadElement('meta[name="twitter:title"]', 'meta', { name: 'twitter:title', content: title });
  upsertHeadElement('meta[name="twitter:description"]', 'meta', { name: 'twitter:description', content: description });
  if (ogImage) {
    upsertHeadElement('meta[property="og:image"]', 'meta', { property: 'og:image', content: ogImage });
    upsertHeadElement('meta[name="twitter:image"]', 'meta', { name: 'twitter:image', content: ogImage });
  }
};
