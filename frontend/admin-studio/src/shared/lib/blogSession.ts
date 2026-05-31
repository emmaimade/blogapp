class BlogSession {
  private static KEY = 'selected_blog_id';

  getBlogId(): string | null {
    return localStorage.getItem(BlogSession.KEY);
  }

  setBlogId(id: string) {
    localStorage.setItem(BlogSession.KEY, id);
  }

  clearBlogId() {
    localStorage.removeItem(BlogSession.KEY);
  }
}

export const blogSession = new BlogSession();
