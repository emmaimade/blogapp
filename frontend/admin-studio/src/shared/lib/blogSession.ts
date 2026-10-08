// Remembers which workspace the user was last in, so /admin and sign-in
// know where to land. It never decides which workspace a page or an API
// call targets — the /admin/w/:workspaceSlug URL does.
class LastWorkspace {
  private static KEY = 'last_workspace_slug';
  // Pre-URL-scoping builds stored the blog id under this key.
  private static LEGACY_ID_KEY = 'selected_blog_id';

  getSlug(): string | null {
    try {
      return localStorage.getItem(LastWorkspace.KEY);
    } catch {
      return null;
    }
  }

  getLegacyBlogId(): number | null {
    try {
      const raw = localStorage.getItem(LastWorkspace.LEGACY_ID_KEY);
      return raw ? Number(raw) || null : null;
    } catch {
      return null;
    }
  }

  setSlug(slug: string) {
    try {
      localStorage.setItem(LastWorkspace.KEY, slug);
      localStorage.removeItem(LastWorkspace.LEGACY_ID_KEY);
    } catch {
      // Storage unavailable (private mode, blocked site data) — landing on
      // the first workspace instead is fine.
    }
  }

  clear() {
    try {
      localStorage.removeItem(LastWorkspace.KEY);
      localStorage.removeItem(LastWorkspace.LEGACY_ID_KEY);
    } catch {
      // See setSlug.
    }
  }
}

export const lastWorkspace = new LastWorkspace();
