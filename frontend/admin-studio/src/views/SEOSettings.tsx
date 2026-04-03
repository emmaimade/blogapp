import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, AlertCircle, Search, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

interface SEOSettingsData {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  google_analytics_id: string;
  google_site_verification: string;
  og_image: string;
  twitter_handle: string;
}

const defaultSEOSettings: SEOSettingsData = {
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  google_analytics_id: '',
  google_site_verification: '',
  og_image: '',
  twitter_handle: '',
};

type PartialSEOSettingsData = Partial<Record<keyof SEOSettingsData, string | null>>;

const normalizeSEOSettings = (settings?: PartialSEOSettingsData | null): SEOSettingsData => ({
  meta_title: settings?.meta_title ?? '',
  meta_description: settings?.meta_description ?? '',
  meta_keywords: settings?.meta_keywords ?? '',
  google_analytics_id: settings?.google_analytics_id ?? '',
  google_site_verification: settings?.google_site_verification ?? '',
  og_image: settings?.og_image ?? '',
  twitter_handle: settings?.twitter_handle ?? '',
});

export const SEOSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: settings = defaultSEOSettings, isLoading } = useQuery<SEOSettingsData>({
    queryKey: ['seoSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/seo');
        return normalizeSEOSettings(res.data);
      } catch (error) {
        return defaultSEOSettings;
      }
    }
  });

  const [formData, setFormData] = useState<SEOSettingsData>(defaultSEOSettings);

  useEffect(() => {
    if (settings) {
      setFormData(normalizeSEOSettings(settings));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: SEOSettingsData) => api.post('/settings/seo', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seoSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allSettings'] });
      toast.success('SEO settings saved successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleChange = (field: keyof SEOSettingsData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
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

  const descriptionLength = (formData.meta_description || '').length;
  const keywordsCount = (formData.meta_keywords || '').split(',').filter((keyword) => keyword.trim()).length;

  return (
    <div className="max-w-4xl">
      
      {/* Info Banner */}
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" size={20} />
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <p className="font-bold mb-1">🔍 Search Engine Optimization</p>
          <p>These settings help search engines understand and rank your blog better.</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Meta Tags */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Search size={20} className="text-indigo-600" />
            Meta Tags
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.meta_title || ''}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                placeholder="My Amazing Blog - Sharing Ideas & Stories"
                maxLength={60}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <div className="flex justify-between text-xs mt-1">
                <p className="text-slate-500">Appears in search results (50-60 characters recommended)</p>
                <p className={`${(formData.meta_title || '').length > 60 ? 'text-red-600' : 'text-slate-500'}`}>
                  {(formData.meta_title || '').length}/60
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Meta Description
              </label>
              <textarea
                value={formData.meta_description || ''}
                onChange={(e) => handleChange('meta_description', e.target.value)}
                placeholder="A modern blog sharing insights on technology, creativity, and personal growth. Join our community of readers and writers."
                maxLength={160}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <div className="flex justify-between text-xs mt-1">
                <p className="text-slate-500">Shows under your title in search results (150-160 characters)</p>
                <p className={`${descriptionLength > 160 ? 'text-red-600' : 'text-slate-500'}`}>
                  {descriptionLength}/160
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Meta Keywords
              </label>
              <input
                type="text"
                value={formData.meta_keywords || ''}
                onChange={(e) => handleChange('meta_keywords', e.target.value)}
                placeholder="blog, technology, writing, tutorials, tips"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <div className="flex justify-between text-xs mt-1">
                <p className="text-slate-500">Comma-separated keywords (5-10 recommended)</p>
                <p className="text-slate-500">{keywordsCount} keywords</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Media / Open Graph */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Social Media Sharing</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Open Graph Image URL
              </label>
              <input
                type="url"
                value={formData.og_image || ''}
                onChange={(e) => handleChange('og_image', e.target.value)}
                placeholder="https://example.com/og-image.jpg"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Image shown when sharing on Facebook, LinkedIn (1200x630px recommended)</p>
            </div>

            {formData.og_image && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-bold text-slate-700 mb-3">Preview</p>
                <img 
                  src={formData.og_image} 
                  alt="OG image preview" 
                  className="w-full max-w-md h-auto rounded-lg border border-slate-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Twitter Handle
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">@</span>
                <input
                  type="text"
                  value={formData.twitter_handle || ''}
                  onChange={(e) => handleChange('twitter_handle', e.target.value)}
                  placeholder="yourusername"
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Used for Twitter Card attribution</p>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-indigo-600" />
            Analytics & Verification
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Google Analytics ID
              </label>
              <input
                type="text"
                value={formData.google_analytics_id || ''}
                onChange={(e) => handleChange('google_analytics_id', e.target.value)}
                placeholder="G-XXXXXXXXXX or UA-XXXXXXXXX-X"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">GA4 Measurement ID or Universal Analytics ID</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Google Site Verification
              </label>
              <input
                type="text"
                value={formData.google_site_verification || ''}
                onChange={(e) => handleChange('google_site_verification', e.target.value)}
                placeholder="ABC123def456..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Verification code from Google Search Console</p>
            </div>
          </div>
        </div>

        {/* SEO Tips */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-3">💡 SEO Tips</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">•</span>
              <span>Keep your meta title under 60 characters to avoid truncation in search results</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">•</span>
              <span>Write compelling meta descriptions between 150-160 characters</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">•</span>
              <span>Use relevant keywords naturally - don't stuff them</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">•</span>
              <span>Update your OG image regularly to keep social shares fresh</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">•</span>
              <span>Monitor your Google Analytics to understand your audience</span>
            </li>
          </ul>
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
