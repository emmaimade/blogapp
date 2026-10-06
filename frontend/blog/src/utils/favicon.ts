const DEFAULT_COLOR = '#18181B';
const HEX_COLOR = /^#(?:[0-9a-f]{3}){1,2}$/i;

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/**
 * Fallback favicon for a tenant without one of their own: the first letter of
 * their site name on a rounded tile in their primary colour, as an inline SVG.
 * Keeps the tab tenant-branded instead of showing the platform's logo.
 * Shared by middleware.ts (server-rendered <head>) and App.tsx (client).
 */
export const letterFavicon = (siteName: string, color?: string | null): string => {
  const letter = (Array.from(siteName.trim())[0] || '').toUpperCase();
  const fill = color && HEX_COLOR.test(color) ? color : DEFAULT_COLOR;
  const glyph = letter.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${fill}"/>` +
    (glyph
      ? `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="38" font-weight="700" fill="#fff">${glyph}</text>`
      : '') +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
