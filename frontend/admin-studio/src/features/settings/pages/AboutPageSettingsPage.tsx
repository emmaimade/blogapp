import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

export const AboutPageSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const publicSiteOrigin =
    import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (window.location.hostname === 'localhost' && window.location.port === '5173'
      ? `${window.location.protocol}//${window.location.hostname}:5174`
      : window.location.origin);
  const previewUrl = `${publicSiteOrigin}/about`;

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['aboutSettings', activeBlog?.id],
    queryFn: async () => {
      let data: any = {};
      try {
        const res = await api.get('/settings/about');
        data = res.data || {};
      } catch (error) {
        // Fallback
      }
      return {
        bio_title: data.bio_title || "Welcome to My Blog",
        bio_subtitle: data.bio_subtitle || "Sharing ideas, stories, and insights",
        bio_content: data.bio_content && data.bio_content !== "This is a modern blog CMS. Customize this in your admin panel." ? data.bio_content : (activeBlog?.description || "This is where you tell your story. Share what makes your blog unique, what topics you cover, and why readers should follow along.\n\nWrite naturally and authentically - this content appears directly on your About page."),
        show_stats: data.show_stats ?? true,
        show_contact_cta: data.show_contact_cta ?? true,
        email: data.email || "",
        social_links: {
          github: data.social_links?.github || "",
          twitter: data.social_links?.twitter || "",
          linkedin: data.social_links?.linkedin || ""
        }
      };
    },
    enabled: !!activeBlog?.id,
  });

  const [formData, setFormData] = useState(settings || {});

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/about', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aboutSettings'] });
      queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
      toast.success('About page settings saved successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handlePreview = () => {
    const draft = {
      bio_title: formData.bio_title || '',
      bio_subtitle: formData.bio_subtitle || '',
      bio_content: formData.bio_content || '',
      show_stats: formData.show_stats !== false,
      show_contact_cta: formData.show_contact_cta !== false,
      email: formData.email || '',
      social_links: {
        github: formData.social_links?.github || '',
        twitter: formData.social_links?.twitter || '',
        linkedin: formData.social_links?.linkedin || ''
      }
    };

    const url = new URL(previewUrl);
    url.searchParams.set('draft', JSON.stringify(draft));
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSocialChange = (platform: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [platform]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl animate-pulse space-y-6 pb-24">
        {/* Info Banner Skeleton */}
        <div className="mb-8 flex items-start gap-3 p-4 bg-zinc-100 rounded-xl dark:bg-zinc-800/50">
          <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2 w-full">
            <div className="h-5 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Form Sections Skeletons */}
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-zinc-200 p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <div className="h-6 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800 mb-4" />
            <div className="space-y-4">
              {[...Array(index === 1 ? 1 : 2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  <div className={"w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50 " + (index === 1 ? 'h-32' : 'h-12')} />
                  <div className="h-3 w-48 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isDirty = settings && JSON.stringify(formData) !== JSON.stringify(settings);

  return (
    <div className="max-w-4xl pb-12 relative">
      {/* Floating Action Bar */}
      <div className={`fixed top-[76px] right-6 md:right-10 z-50 transition-all duration-300 ${isDirty ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3 rounded-full border border-zinc-200/50 bg-white/80 p-1.5 pl-4 shadow-lg backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2 pr-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Unsaved changes
            </span>
          </div>
          
          <button
            type="button"
            onClick={handlePreview}
            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Eye size={14} />
            Preview
          </button>

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
            Save
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-900" size={20} />
        <div className="text-sm text-zinc-700 dark:text-zinc-200">
          <p className="font-bold mb-1">💡 Tip: Make it personal!</p>
          <p>Share your unique story, what makes your blog special, and why readers should follow along. This content appears on your public About page.</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        
        {/* Hero Section */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Hero Section</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.bio_title || ''}
                onChange={(e) => handleChange('bio_title', e.target.value)}
                placeholder="Welcome to My Blog"
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">The main headline on your About page</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={formData.bio_subtitle || ''}
                onChange={(e) => handleChange('bio_subtitle', e.target.value)}
                placeholder="Sharing ideas, stories, and insights"
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">A short tagline that appears under the title</p>
            </div>
          </div>
        </div>

        {/* Bio Content */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Your Story</h2>
          
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2">
              Bio Content
            </label>
            <textarea
              value={formData.bio_content || ''}
              onChange={(e) => handleChange('bio_content', e.target.value)}
              placeholder="Share your story here. What makes your blog unique? What topics do you cover? Why should readers follow along?"
              rows={12}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm leading-relaxed"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Write naturally - use line breaks to create paragraphs. Your content will be displayed exactly as you type it.
            </p>
          </div>
        </div>

        {/* Display Options */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Display Options</h2>
          
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-zinc-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_stats !== false}
                onChange={(e) => handleChange('show_stats', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary mt-0.5"
              />
              <div>
                <div className="font-bold text-zinc-900">Show Stats</div>
                <div className="text-sm text-zinc-600">Display article count, total views, and project count</div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-zinc-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_contact_cta !== false}
                onChange={(e) => handleChange('show_contact_cta', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary mt-0.5"
              />
              <div>
                <div className="font-bold text-zinc-900">Show Contact Section</div>
                <div className="text-sm text-zinc-600">Display "Let's Connect" call-to-action at the bottom</div>
              </div>
            </label>
          </div>
        </div>

        {/* Contact Information */}
        {formData.show_contact_cta !== false && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">Contact Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="hello@example.com"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <p className="text-xs text-zinc-500 mt-1">Used for the "Get in Touch" button</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={formData.social_links?.github || ''}
                    onChange={(e) => handleSocialChange('github', e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">
                    Twitter URL
                  </label>
                  <input
                    type="url"
                    value={formData.social_links?.twitter || ''}
                    onChange={(e) => handleSocialChange('twitter', e.target.value)}
                    placeholder="https://twitter.com/username"
                    className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-zinc-700 mb-2">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={formData.social_links?.linkedin || ''}
                    onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        
      </div>
    </div>
  );
};
