import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const titleSegments = pathSegments.filter(segment => isNaN(Number(segment)));
    if (titleSegments.length === 0) return 'Dashboard';
    
    // Handle settings sub-routes
    if (titleSegments[0] === 'admin' && titleSegments[1] === 'settings' && titleSegments[2]) {
      const settingType = titleSegments[2];
      return settingType.charAt(0).toUpperCase() + settingType.slice(1) + ' Settings';
    }
    
    const mainSection = titleSegments[titleSegments.length - 1];
    return mainSection.charAt(0).toUpperCase() + mainSection.slice(1);
  };

  const getPageDescription = () => {
    const path = location.pathname;
    
    // Page-specific descriptions
    const descriptions: Record<string, string> = {
      '/admin/dashboard': 'Overview of your blog performance and activity',
      '/admin/posts': 'Manage your blog posts and articles',
      '/admin/posts/new': 'Create a new blog post or article',
      '/admin/tags': 'Organize your content with tags and categories',
      '/admin/comments': 'Moderate and manage reader comments',
      '/admin/users': 'Manage user accounts and permissions',
      '/admin/settings/general': 'Configure site-wide settings',
      '/admin/settings/about': 'Customize your About page content',
      '/admin/settings/footer': 'Configure footer content and links',
      '/admin/settings/branding': 'Customize colors, logo, and fonts',
      '/admin/settings/seo': 'Optimize your blog for search engines',
      '/admin/settings/contact': 'Manage contact page and information',
    };

    // Check for exact match
    if (descriptions[path]) return descriptions[path];
    
    // Check for edit/view routes
    if (path.includes('/edit/')) return 'Edit and update this post';
    if (path.includes('/view/')) return 'Preview and review this post';
    
    // Default
    return 'Manage your blog content';
  };

  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      <Sidebar />

      <main className="min-h-screen lg:pl-72">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-20 sm:px-6 md:px-8 lg:px-8 lg:pt-8 xl:px-10">
          
          {/* ✅ Industry Standard Header - Minimal & Clean */}
          <header className="mb-8">
            <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
              
              {/* Left: Title + Description */}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  {getPageTitle()}
                </h1>
                <p className="mt-1 sm:mt-1.5 truncate text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  {getPageDescription()}
                </p>
              </div>

              {/* Right: User Profile Only */}
              {user && (
                <>
                  {/* Tablet+: Full profile card */}
                  <div className="hidden sm:flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-shrink-0">
                    <div className="text-right min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {user.username}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {user.role}
                      </div>
                    </div>
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-sm font-bold text-white shadow-md">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};