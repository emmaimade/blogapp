import { useEffect } from 'react';
import api from '../api/blogApi';

// Storage can be unavailable (private windows, blocked site data). Counting a
// view twice is better than breaking the page, so every access is guarded.
const read = (storage: () => Storage, key: string): string | null => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: () => Storage, key: string, value: string) => {
  try {
    storage().setItem(key, value);
  } catch {
    // Not remembered; at worst the view is counted again.
  }
};

/**
 * Records one read of a post for the workspace's view stats: once per post
 * per browser session, so refreshes and back-navigation don't add up. The
 * first view of the day from this browser also counts it as a visitor, and
 * the first view of a visit (browser session) carries where the reader came
 * from: document.referrer stays the outside page that brought them for the
 * whole visit, since moving around inside the blog doesn't reload it.
 * The server ignores the workspace's own team, crawlers and unpublished posts.
 */
export const useRecordView = (postId: number | undefined) => {
  useEffect(() => {
    if (!postId) return;

    const viewedKey = `inko:viewed:${postId}`;
    if (read(() => sessionStorage, viewedKey)) return;
    write(() => sessionStorage, viewedKey, '1');

    const today = new Date().toISOString().slice(0, 10); // UTC, like the server's days
    const visitedKey = `inko:visited:${read(() => localStorage, 'public_blog_id') ?? ''}`;
    const newVisitor = read(() => localStorage, visitedKey) !== today;
    if (newVisitor) write(() => localStorage, visitedKey, today);

    const visitKey = 'inko:visit-counted';
    const firstOfVisit = !read(() => sessionStorage, visitKey);
    if (firstOfVisit) write(() => sessionStorage, visitKey, '1');

    api.post(`/posts/${postId}/view`, {
      new_visitor: newVisitor,
      // "" means nobody referred them (typed or bookmarked): counted as Direct.
      ...(firstOfVisit ? { referrer: document.referrer } : {}),
    }).catch(() => {
      // Stats are best-effort; a failed count never affects the reader.
    });
  }, [postId]);
};
