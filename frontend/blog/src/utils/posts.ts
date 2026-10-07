/** Strips Markdown syntax down to plain text and truncates for preview use. */
export const getPlainExcerpt = (content: string, length: number = 150): string => {
  if (!content) return '';

  const clean = content
    .replace(/^#+\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
};

/** Small view counts read as a negative signal, so they're only shown past this. */
export const MIN_VISIBLE_VIEWS = 50;

export const shouldShowViews = (views: number | undefined): views is number =>
  (views ?? 0) >= MIN_VISIBLE_VIEWS;

/**
 * Counts the ATX headings (`#`–`####`) that become the article's h2–h4 —
 * the same levels the table of contents is built from — ignoring fenced code,
 * where `#` lines are comments rather than headings.
 */
export const countMarkdownHeadings = (content: string): number => {
  if (!content) return 0;
  const withoutCode = content.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
  return (withoutCode.match(/^ {0,3}#{1,4}[ \t]+\S/gm) ?? []).length;
};

/** The date readers see: when the post went live, or its creation date if it never has. */
export const getPostDate = (post: { published_at?: string | null; created_at: string }): string =>
  post.published_at || post.created_at;

/**
 * When to tell readers the post was revised: only for an edit on a later day
 * than the date shown, so a same-day typo fix doesn't add a second identical date.
 */
export const getEditedDate = (
  post: { published_at?: string | null; edited_at?: string | null; created_at: string },
  format: (iso: string) => string,
): string | null =>
  post.edited_at && format(post.edited_at) !== format(getPostDate(post)) ? post.edited_at : null;

/** The one place a tag is browsed: the blog list filtered by it (`/tag/:tag` redirects here). */
export const tagUrl = (tag: string): string => `/blog?tag=${encodeURIComponent(tag)}`;

/** URL-safe heading anchor that keeps non-Latin letters (e.g. "Réact" → "react", "日本語" stays). */
export const slugify = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/(^-|-$)/g, '');
