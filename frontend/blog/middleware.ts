/**
 * Vercel Routing Middleware: server-renders each page's <head> metadata.
 *
 * The blog is a client-rendered SPA, and link-preview crawlers (X, LinkedIn,
 * Facebook, Slack, WhatsApp…) don't run JavaScript — without this, every
 * shared link previews as whatever static tags are in index.html. This swaps
 * the `<!-- seo:start -->…<!-- seo:end -->` block for the tenant's (and, on
 * /post/:slug, the post's) real title/description/canonical/OG/JSON-LD.
 * usePageMeta/applyPageMeta then keep those tags current during client-side
 * navigation, which never reaches this middleware.
 *
 * Any failure (no BACKEND_URL, slow/failed lookup, unknown host, missing
 * markers) falls through to the untouched SPA — this must never break a page.
 *
 * Only runs on Vercel (`vercel dev` or a deployment), not under `vite dev`.
 */

import { letterFavicon } from './src/utils/favicon';

export const config = {
  // Page routes only — not the API proxy or built assets.
  matcher: '/((?!api/|assets/).*)',
};

const META_TIMEOUT_MS = 1500;
const SEO_BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;

interface PageMetaPost {
  title: string;
  slug: string;
  description: string;
  image?: string | null;
  author_name?: string | null;
  published_at: string;
  updated_at: string;
}

interface PageMeta {
  site_name: string;
  site_tagline?: string | null;
  site_description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image?: string | null;
  twitter_handle?: string | null;
  favicon_url?: string | null;
  primary_color?: string | null;
  language: string;
  post?: PageMetaPost | null;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// JSON.stringify alone can't go inside <script>: a "</script>" in a post
// title would close the tag early. Escaping "<" (and the JS line separators)
// keeps the JSON identical once parsed.
const safeJsonLd = (data: unknown) =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');

const absoluteUrl = (url: string | null | undefined, origin: string) => {
  if (!url) return undefined;
  try {
    return new URL(url, origin).toString();
  } catch {
    return undefined;
  }
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Mirrors the titles each page sets client-side (usePageMeta / Home / PostDetail),
// so the server-rendered title doesn't change once the app hydrates.
const pageTitle = (url: URL, meta: PageMeta) => {
  const { pathname } = url;
  const site = meta.site_name;
  if (meta.post) return `${meta.post.title} · ${site}`;
  if (pathname === '/') {
    return meta.seo_title || (meta.site_tagline ? `${site} - ${meta.site_tagline}` : site);
  }

  const tag = url.searchParams.get('tag')?.trim();
  if (pathname.replace(/\/$/, '') === '/blog' && tag) return `Posts tagged “${tag}” · ${site}`;

  const staticTitles: Record<string, string> = {
    '/blog': 'Blog',
    '/about': 'About',
    '/contact': 'Contact',
    '/auth': 'Sign in',
  };
  const page = staticTitles[pathname.replace(/\/$/, '')];
  if (page) return `${page} · ${site}`;

  if (pathname.replace(/\/$/, '') === '/search') {
    const q = url.searchParams.get('q')?.trim();
    return `${q ? `Search results for “${q}”` : 'Search'} · ${site}`;
  }

  return site;
};

// Query strings are dropped from the canonical URL, except a tag on /blog:
// that's the blog's tag page, a distinct page rather than a view of /blog.
const canonicalUrl = (url: URL) => {
  const tag = url.searchParams.get('tag');
  if (url.pathname.replace(/\/$/, '') === '/blog' && tag) {
    return `${url.origin}/blog?tag=${encodeURIComponent(tag)}`;
  }
  return `${url.origin}${url.pathname}`;
};

const renderHead = (url: URL, meta: PageMeta) => {
  const canonical = canonicalUrl(url);
  const title = pageTitle(url, meta);
  const description = meta.post?.description || meta.seo_description || meta.site_description || '';
  const image = absoluteUrl(meta.post?.image || meta.og_image, url.origin);
  const twitterHandle = meta.twitter_handle
    ? meta.twitter_handle.startsWith('@') ? meta.twitter_handle : `@${meta.twitter_handle}`
    : undefined;

  const tags: Array<[string, string, string]> = [
    ['name', 'description', description],
    ['property', 'og:type', meta.post ? 'article' : 'website'],
    ['property', 'og:url', canonical],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:site_name', meta.site_name],
    ['name', 'twitter:card', image ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ];
  if (image) {
    tags.push(['property', 'og:image', image], ['name', 'twitter:image', image]);
  }
  if (twitterHandle) tags.push(['name', 'twitter:creator', twitterHandle]);
  if (meta.post) {
    tags.push(['property', 'article:published_time', meta.post.published_at]);
    tags.push(['property', 'article:modified_time', meta.post.updated_at]);
  }

  const jsonLd = meta.post
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: meta.post.title,
        description,
        url: canonical,
        mainEntityOfPage: canonical,
        datePublished: meta.post.published_at,
        dateModified: meta.post.updated_at,
        ...(image && { image }),
        ...(meta.post.author_name && { author: { '@type': 'Person', name: meta.post.author_name } }),
        publisher: { '@type': 'Organization', name: meta.site_name },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: meta.site_name,
        url: url.origin,
        ...(description && { description }),
      };

  const uploadedFavicon = absoluteUrl(meta.favicon_url, url.origin);
  const favicon = uploadedFavicon || letterFavicon(meta.site_name, meta.primary_color);

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="icon" href="${escapeHtml(favicon)}" />`,
    ...(uploadedFavicon ? [`<link rel="apple-touch-icon" href="${escapeHtml(uploadedFavicon)}" />`] : []),
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    ...tags.map(([attr, key, content]) => `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`),
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
  ].join('\n    ');
};

const fetchPageMeta = async (backendUrl: string, host: string, path: string): Promise<PageMeta | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const endpoint = new URL('/blogs/meta', backendUrl);
    endpoint.searchParams.set('host', host);
    endpoint.searchParams.set('path', path);
    const res = await fetch(endpoint, { signal: controller.signal });
    return res.ok ? ((await res.json()) as PageMeta) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const backendUrl = process.env.BACKEND_URL;

  // Tags moved to /blog?tag= — old /tag/:tag links get a permanent redirect,
  // so shared links and search results carry over. (The SPA also redirects,
  // for `vite dev` and client-side navigation.)
  const oldTag = url.pathname.match(/^\/tag\/([^/]+)\/?$/);
  if (request.method === 'GET' && oldTag) {
    const target = new URL(`/blog?tag=${encodeURIComponent(safeDecode(oldTag[1]))}`, url.origin);
    return Response.redirect(target.toString(), 301);
  }

  // Files (favicon.ico, placeholder.svg, robots.txt…) and non-GETs pass through.
  if (request.method !== 'GET' || url.pathname.includes('.') || !backendUrl) return undefined;

  try {
    const [meta, shell] = await Promise.all([
      fetchPageMeta(backendUrl, url.hostname, safeDecode(url.pathname)),
      fetch(new URL('/index.html', url.origin)),
    ]);
    if (!meta || !shell.ok) return undefined;

    const html = await shell.text();
    if (!SEO_BLOCK.test(html)) return undefined;

    const rendered = html
      .replace(SEO_BLOCK, () => renderHead(url, meta))
      .replace(/<html lang="[^"]*"/, () => `<html lang="${escapeHtml(meta.language || 'en')}"`);

    return new Response(rendered, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
        'x-page-meta': 'rendered',
      },
    });
  } catch {
    return undefined;
  }
}
