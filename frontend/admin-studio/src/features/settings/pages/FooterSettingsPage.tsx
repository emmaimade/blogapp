import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

export const FooterSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['footerSettings', activeBlog?.id],
    queryFn: async () => {
      let data: any = {};
      try {
        const res = await api.get('/settings/footer');
        data = res.data || {};
      } catch (error) {
        // Fallback
      }
      return {
        footer_text: data.footer_text && data.footer_text !== "Your ideas, amplified." ? data.footer_text : (activeBlog?.tagline || "Your ideas, amplified."),
        show_newsletter: data.show_newsletter ?? true,
        newsletter_title: data.newsletter_title || "Newsletter",
        newsletter_description: data.newsletter_description || "Get the latest posts delivered to your inbox.",
        show_social_links: data.show_social_links ?? true,
        social_links: {
          github: data.social_links?.github || "",
          twitter: data.social_links?.twitter || "",
          linkedin: data.social_links?.linkedin || "",
          instagram: data.social_links?.instagram || "",
          youtube: data.social_links?.youtube || "",
          facebook: data.social_links?.facebook || ""
        },
        copyright_text: data.copyright_text || "© {year} Inko. All rights reserved.",
        show_quick_links: data.show_quick_links ?? true,
        show_categories: data.show_categories ?? true
      };
    },
    enabled: !!activeBlog?.id,
  });

  const [formData, setFormData] = useState(settings || {});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/footer', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['footerSettings', activeBlog?.id] });
      toast.success('Footer settings saved successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    }
  });
  const handleSave = () => {
    saveMutation.mutate(formData);
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
        <div className="mb-8 flex items-start gap-3 p-4 bg-zinc-100 rounded-xl dark:bg-zinc-800/50">
          <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2 w-full">
            <div className="h-5 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-zinc-200 p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              {index > 0 && <div className="h-5 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />}
            </div>
            <div className={index === 2 ? 'grid md:grid-cols-2 gap-4' : 'space-y-4'}>
              {[...Array(index === 2 ? 6 : 2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  <div className={`w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50 ${index === 1 && i === 1 ? 'h-20' : 'h-12'}`} />
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
      <div className={`fixed top-[76px] right-6 md:right-10 z-50 transition-all duration-300 ${isDirty ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3 rounded-full border border-zinc-200/50 bg-white/80 p-1.5 pl-4 shadow-lg backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Unsaved changes
            </span>
          </div>
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

      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-900" size={20} />
        <div className="text-sm text-zinc-700 dark:text-zinc-200">
          Configure footer copy, newsletter prompts, and social links shown on your public blog.
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Footer Branding</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Footer Text / Tagline
              </label>
              <input
                type="text"
                value={formData.footer_text || ''}
                onChange={(e) => handleChange('footer_text', e.target.value)}
                placeholder="Your ideas, amplified."
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">Short text that appears under your logo in the footer</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Copyright Text
              </label>
              <input
                type="text"
                value={formData.copyright_text || ''}
                onChange={(e) => handleChange('copyright_text', e.target.value)}
                placeholder="© {year} Inko. All rights reserved."
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">Use {`{year}`} for automatic current year</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900">Newsletter Section</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_newsletter !== false}
                onChange={(e) => handleChange('show_newsletter', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary"
              />
              <span className="text-sm font-medium text-zinc-700">Show Newsletter</span>
            </label>
          </div>
          
          {formData.show_newsletter !== false && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Newsletter Title
                </label>
                <input
                  type="text"
                  value={formData.newsletter_title || ''}
                  onChange={(e) => handleChange('newsletter_title', e.target.value)}
                  placeholder="Newsletter"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Newsletter Description
                </label>
                <textarea
                  value={formData.newsletter_description || ''}
                  onChange={(e) => handleChange('newsletter_description', e.target.value)}
                  placeholder="Get the latest posts delivered to your inbox."
                  rows={2}
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900">Social Media Links</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_social_links !== false}
                onChange={(e) => handleChange('show_social_links', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary"
              />
              <span className="text-sm font-medium text-zinc-700">Show Social Links</span>
            </label>
          </div>
          
          {formData.show_social_links !== false && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  GitHub
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
                  Twitter
                </label>
                <input
                  type="url"
                  value={formData.social_links?.twitter || ''}
                  onChange={(e) => handleSocialChange('twitter', e.target.value)}
                  placeholder="https://twitter.com/username"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={formData.social_links?.linkedin || ''}
                  onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Instagram
                </label>
                <input
                  type="url"
                  value={formData.social_links?.instagram || ''}
                  onChange={(e) => handleSocialChange('instagram', e.target.value)}
                  placeholder="https://instagram.com/username"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  YouTube
                </label>
                <input
                  type="url"
                  value={formData.social_links?.youtube || ''}
                  onChange={(e) => handleSocialChange('youtube', e.target.value)}
                  placeholder="https://youtube.com/@username"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Facebook
                </label>
                <input
                  type="url"
                  value={formData.social_links?.facebook || ''}
                  onChange={(e) => handleSocialChange('facebook', e.target.value)}
                  placeholder="https://facebook.com/username"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Footer Sections</h2>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-zinc-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_quick_links !== false}
                onChange={(e) => handleChange('show_quick_links', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary mt-0.5"
              />
              <div>
                <div className="font-bold text-zinc-900">Show Quick Links</div>
                <div className="text-sm text-zinc-600">Display navigation links (Home, Blog, About, Contact)</div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-zinc-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_categories !== false}
                onChange={(e) => handleChange('show_categories', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary mt-0.5"
              />
              <div>
                <div className="font-bold text-zinc-900">Show Popular Topics</div>
                <div className="text-sm text-zinc-600">Display top tags/categories from your posts</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
