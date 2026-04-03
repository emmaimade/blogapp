import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

export const FooterSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['footerSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/footer');
        return res.data;
      } catch (error) {
        return {
          footer_text: "Your ideas, amplified.",
          show_newsletter: true,
          newsletter_title: "Newsletter",
          newsletter_description: "Get the latest posts delivered to your inbox.",
          show_social_links: true,
          social_links: {
            github: "",
            twitter: "",
            linkedin: "",
            instagram: "",
            youtube: "",
            facebook: ""
          },
          copyright_text: "© {year} Inko. All rights reserved.",
          show_quick_links: true,
          show_categories: true
        };
      }
    }
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
      queryClient.invalidateQueries({ queryKey: ['footerSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allSettings'] });
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={40} />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      
      {/* Info Banner */}
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" size={20} />
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <p className="font-bold mb-1">💡 Footer Customization</p>
          <p>Control what appears in your site's footer. Changes apply site-wide.</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Footer Text */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Footer Branding</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Footer Text / Tagline
              </label>
              <input
                type="text"
                value={formData.footer_text || ''}
                onChange={(e) => handleChange('footer_text', e.target.value)}
                placeholder="Your ideas, amplified."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Short text that appears under your logo in the footer</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Copyright Text
              </label>
              <input
                type="text"
                value={formData.copyright_text || ''}
                onChange={(e) => handleChange('copyright_text', e.target.value)}
                placeholder="© {year} Inko. All rights reserved."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Use {`{year}`} for automatic current year</p>
            </div>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Newsletter Section</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_newsletter !== false}
                onChange={(e) => handleChange('show_newsletter', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Show Newsletter</span>
            </label>
          </div>
          
          {formData.show_newsletter !== false && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Newsletter Title
                </label>
                <input
                  type="text"
                  value={formData.newsletter_title || ''}
                  onChange={(e) => handleChange('newsletter_title', e.target.value)}
                  placeholder="Newsletter"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Newsletter Description
                </label>
                <textarea
                  value={formData.newsletter_description || ''}
                  onChange={(e) => handleChange('newsletter_description', e.target.value)}
                  placeholder="Get the latest posts delivered to your inbox."
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Social Links */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Social Media Links</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_social_links !== false}
                onChange={(e) => handleChange('show_social_links', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Show Social Links</span>
            </label>
          </div>
          
          {formData.show_social_links !== false && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  GitHub
                </label>
                <input
                  type="url"
                  value={formData.social_links?.github || ''}
                  onChange={(e) => handleSocialChange('github', e.target.value)}
                  placeholder="https://github.com/username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Twitter
                </label>
                <input
                  type="url"
                  value={formData.social_links?.twitter || ''}
                  onChange={(e) => handleSocialChange('twitter', e.target.value)}
                  placeholder="https://twitter.com/username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={formData.social_links?.linkedin || ''}
                  onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Instagram
                </label>
                <input
                  type="url"
                  value={formData.social_links?.instagram || ''}
                  onChange={(e) => handleSocialChange('instagram', e.target.value)}
                  placeholder="https://instagram.com/username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  YouTube
                </label>
                <input
                  type="url"
                  value={formData.social_links?.youtube || ''}
                  onChange={(e) => handleSocialChange('youtube', e.target.value)}
                  placeholder="https://youtube.com/@username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Facebook
                </label>
                <input
                  type="url"
                  value={formData.social_links?.facebook || ''}
                  onChange={(e) => handleSocialChange('facebook', e.target.value)}
                  placeholder="https://facebook.com/username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Display Options */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Footer Sections</h2>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-slate-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_quick_links !== false}
                onChange={(e) => handleChange('show_quick_links', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
              />
              <div>
                <div className="font-bold text-slate-900">Show Quick Links</div>
                <div className="text-sm text-slate-600">Display navigation links (Home, Blog, About, Contact)</div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-slate-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_categories !== false}
                onChange={(e) => handleChange('show_categories', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
              />
              <div>
                <div className="font-bold text-slate-900">Show Popular Topics</div>
                <div className="text-sm text-slate-600">Display top tags/categories from your posts</div>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="sticky bottom-0 bg-white border border-slate-200 rounded-xl p-4 shadow-lg">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
