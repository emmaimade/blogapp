import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Eye, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

export const AboutPageSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const publicSiteOrigin =
    import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (window.location.hostname === 'localhost' && window.location.port === '5173'
      ? `${window.location.protocol}//${window.location.hostname}:5174`
      : window.location.origin);
  const previewUrl = `${publicSiteOrigin}/about`;

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['aboutSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/about');
        return res.data;
      } catch (error) {
        // Return defaults if not configured yet
        return {
          bio_title: "Welcome to My Blog",
          bio_subtitle: "Sharing ideas, stories, and insights",
          bio_content: "This is where you tell your story. Share what makes your blog unique, what topics you cover, and why readers should follow along.\n\nWrite naturally and authentically - this content appears directly on your About page.",
          show_stats: true,
          show_contact_cta: true,
          email: "",
          social_links: {
            github: "",
            twitter: "",
            linkedin: ""
          }
        };
      }
    }
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
          <p className="font-bold mb-1">💡 Tip: Make it personal!</p>
          <p>Share your unique story, what makes your blog special, and why readers should follow along. This content appears on your public About page.</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        
        {/* Hero Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Hero Section</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.bio_title || ''}
                onChange={(e) => handleChange('bio_title', e.target.value)}
                placeholder="Welcome to My Blog"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">The main headline on your About page</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={formData.bio_subtitle || ''}
                onChange={(e) => handleChange('bio_subtitle', e.target.value)}
                placeholder="Sharing ideas, stories, and insights"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">A short tagline that appears under the title</p>
            </div>
          </div>
        </div>

        {/* Bio Content */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Your Story</h2>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Bio Content
            </label>
            <textarea
              value={formData.bio_content || ''}
              onChange={(e) => handleChange('bio_content', e.target.value)}
              placeholder="Share your story here. What makes your blog unique? What topics do you cover? Why should readers follow along?"
              rows={12}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm leading-relaxed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Write naturally - use line breaks to create paragraphs. Your content will be displayed exactly as you type it.
            </p>
          </div>
        </div>

        {/* Display Options */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Display Options</h2>
          
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-slate-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_stats !== false}
                onChange={(e) => handleChange('show_stats', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
              />
              <div>
                <div className="font-bold text-slate-900">Show Stats</div>
                <div className="text-sm text-slate-600">Display article count, total views, and project count</div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-slate-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={formData.show_contact_cta !== false}
                onChange={(e) => handleChange('show_contact_cta', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
              />
              <div>
                <div className="font-bold text-slate-900">Show Contact Section</div>
                <div className="text-sm text-slate-600">Display "Let's Connect" call-to-action at the bottom</div>
              </div>
            </label>
          </div>
        </div>

        {/* Contact Information */}
        {formData.show_contact_cta !== false && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Contact Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="hello@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Used for the "Get in Touch" button</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    GitHub URL
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
                    Twitter URL
                  </label>
                  <input
                    type="url"
                    value={formData.social_links?.twitter || ''}
                    onChange={(e) => handleSocialChange('twitter', e.target.value)}
                    placeholder="https://twitter.com/username"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={formData.social_links?.linkedin || ''}
                    onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="sticky bottom-0 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:flex-row sm:gap-4">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          
          <button
            type="button"
            onClick={handlePreview}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-6 py-3 font-bold text-slate-700 transition-all hover:bg-slate-200"
          >
            <Eye size={20} />
            Preview
          </button>
        </div>
      </div>
    </div>
  );
};
