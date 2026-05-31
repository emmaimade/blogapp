import React, { createContext, useContext, useEffect, useState } from 'react';
import { blogSession } from '../../shared/lib/blogSession';
import { useAuth } from '../../features/auth/context/AuthContext';
import type { MembershipBlog, UserBlogMembership } from '../../features/auth/types';

export type Blog = MembershipBlog;
export type BlogMembership = UserBlogMembership;

interface BlogContextType {
  activeBlog: Blog | null;
  activeMembership: BlogMembership | null;
  activeRole: BlogMembership['role'] | null;
  blogs: Blog[];
  memberships: BlogMembership[];
  requiresOnboarding: boolean;
  setActiveBlogId: (id: number) => void;
  isLoading: boolean;
}

const BlogContext = createContext<BlogContextType | undefined>(undefined);

export function BlogProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeBlogId, setActiveBlogIdState] = useState<number | null>(() => {
    const saved = blogSession.getBlogId();
    return saved ? parseInt(saved, 10) : null;
  });

  const memberships = user?.blog_memberships ?? [];
  const blogs = memberships.map((membership) => membership.blog);
  const isLoading = isAuthLoading;

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveBlogIdState(null);
      return;
    }

    if (memberships.length === 0) {
      blogSession.clearBlogId();
      setActiveBlogIdState(null);
      return;
    }

    const matchingMembership = memberships.find((membership) => membership.blog.id === activeBlogId);
    if (!matchingMembership) {
      const nextBlogId = memberships[0].blog.id;
      setActiveBlogIdState(nextBlogId);
      blogSession.setBlogId(nextBlogId.toString());
    }
  }, [memberships, activeBlogId, isAuthenticated]);

  const setActiveBlogId = (id: number) => {
    setActiveBlogIdState(id);
    blogSession.setBlogId(id.toString());
    // Optionally trigger a full reload to force components to refresh with the new blog scope
    window.location.reload(); 
  };

  const activeMembership = memberships.find((membership) => membership.blog.id === activeBlogId) || null;
  const activeBlog = activeMembership?.blog || null;
  const activeRole = activeMembership?.role || null;
  const requiresOnboarding = !!activeBlog && activeBlog.onboarding_status !== 'completed';

  return (
    <BlogContext.Provider value={{ activeBlog, activeMembership, activeRole, blogs, memberships, requiresOnboarding, setActiveBlogId, isLoading }}>
      {children}
    </BlogContext.Provider>
  );
}

export function useBlog() {
  const context = useContext(BlogContext);
  if (context === undefined) {
    throw new Error('useBlog must be used within a BlogProvider');
  }
  return context;
}
