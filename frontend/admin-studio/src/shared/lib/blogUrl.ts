// Where a workspace's public blog lives: its own domain when it has one, its
// inko.blog address otherwise, and the local blog dev server in development.
const DEV_BLOG_URL = import.meta.env.VITE_BLOG_URL || 'http://localhost:5174';

interface BlogAddress {
  subdomain: string;
  custom_domain?: string | null;
}

export const getBlogUrl = ({ subdomain, custom_domain }: BlogAddress): string => {
  if (custom_domain) return `https://${custom_domain}`;
  if (import.meta.env.DEV) return DEV_BLOG_URL;
  return `https://${subdomain}.inko.blog`;
};

/** The address shown to people, without the scheme. */
export const getBlogDisplayUrl = (blog: BlogAddress): string =>
  getBlogUrl(blog).replace(/^https?:\/\//, '');

/** A post on the public blog — matches the blog's `/post/:slug` route. */
export const getPostUrl = (blog: BlogAddress, slug: string): string =>
  `${getBlogUrl(blog)}/post/${encodeURIComponent(slug)}`;
