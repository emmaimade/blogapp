import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, Search, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

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
  const { activeBlog } = useBlog();

  const { data: settings = defaultSEOSettings, isLoading } = useQuery<SEOSettingsData>({
    queryKey: ['seoSettings', activeBlog?.id],
    queryFn: async () => {
      let data: PartialSEOSettingsData = {};
      try {
        const res = await api.get('/settings/seo');
        data = res.data || {};
      } catch (error) {
        // Fallback
      }
      
      const normalized = normalizeSEOSettings(data);
      return {
        ...normalized,
        meta_title: normalized.meta_title || activeBlog?.name || '',
        meta_description: normalized.meta_description || activeBlog?.description || '',
      };
    },
    enabled: !!activeBlog?.id,
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
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-zinc-200 p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-6 w-32 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="space-y-6">
              {[...Array(index === 0 ? 3 : 2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  <div className={`w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50 ${index === 0 && i === 1 ? 'h-24' : 'h-12'}`} />
                  <div className="h-3 w-64 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const descriptionLength = (formData.meta_description || '').length;
  const keywordsCount = (formData.meta_keywords || '').split(',').filter((keyword) => keyword.trim()).length;

  const isDirty = settings && (
    formData.meta_title !== settings.meta_title ||
    formData.meta_description !== settings.meta_description ||
    formData.meta_keywords !== settings.meta_keywords ||
    formData.google_analytics_id !== settings.google_analytics_id ||
    formData.google_site_verification !== settings.google_site_verification ||
    formData.og_image !== settings.og_image ||
    formData.twitter_handle !== settings.twitter_handle
  );

  return (
    <div className="max-w-4xl pb-12 relative">
      
      {/* Floating Save Button */}
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

      {/* Info Banner */}
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-900" size={20} />
        <div className="text-sm text-zinc-700 dark:text-zinc-200">
          <p className="font-bold mb-1">🔍 Search Engine Optimization</p>
          <p>These settings help search engines understand and rank your blog better.</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Meta Tags */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Search size={20} className="text-zinc-900" />
            Meta Tags
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.meta_title || ''}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                placeholder="My Amazing Blog - Sharing Ideas & Stories"
                maxLength={60}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <div className="flex justify-between text-xs mt-1">
                <p className="text-zinc-500">Appears in search results (50-60 characters recommended)</p>
                <p className={`${(formData.meta_title || '').length > 60 ? 'text-red-600' : 'text-zinc-500'}`}>
                  {(formData.meta_title || '').length}/60
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Meta Description
              </label>
              <textarea
                value={formData.meta_description || ''}
                onChange={(e) => handleChange('meta_description', e.target.value)}
                placeholder="A modern blog sharing insights on technology, creativity, and personal growth. Join our community of readers and writers."
                maxLength={160}
                rows={3}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <div className="flex justify-between text-xs mt-1">
                <p className="text-zinc-500">Shows under your title in search results (150-160 characters)</p>
                <p className={`${descriptionLength > 160 ? 'text-red-600' : 'text-zinc-500'}`}>
                  {descriptionLength}/160
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Meta Keywords
              </label>
              <input
                type="text"
                value={formData.meta_keywords || ''}
                onChange={(e) => handleChange('meta_keywords', e.target.value)}
                placeholder="blog, technology, writing, tutorials, tips"
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <div className="flex justify-between text-xs mt-1">
                <p className="text-zinc-500">Comma-separated keywords (5-10 recommended)</p>
                <p className="text-zinc-500">{keywordsCount} keywords</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Media / Open Graph */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Social Media Sharing</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Open Graph Image URL
              </label>
              <input
                type="url"
                value={formData.og_image || ''}
                onChange={(e) => handleChange('og_image', e.target.value)}
                placeholder="https://example.com/og-image.jpg"
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">Image shown when sharing on Facebook, LinkedIn (1200x630px recommended)</p>
            </div>

            {formData.og_image && (
              <div className="p-4 bg-zinc-50 rounded-xl">
                <p className="text-sm font-bold text-zinc-700 mb-3">Preview</p>
                <img 
                  src={formData.og_image} 
                  alt="OG image preview" 
                  className="w-full max-w-md h-auto rounded-lg border border-zinc-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Twitter Handle
              </label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 font-bold">@</span>
                <input
                  type="text"
                  value={formData.twitter_handle || ''}
                  onChange={(e) => handleChange('twitter_handle', e.target.value)}
                  placeholder="yourusername"
                  className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Used for Twitter Card attribution</p>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-zinc-900" />
            Analytics & Verification
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Google Analytics ID
              </label>
              <input
                type="text"
                value={formData.google_analytics_id || ''}
                onChange={(e) => handleChange('google_analytics_id', e.target.value)}
                placeholder="G-XXXXXXXXXX or UA-XXXXXXXXX-X"
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1">GA4 Measurement ID or Universal Analytics ID</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Google Site Verification
              </label>
              <input
                type="text"
                value={formData.google_site_verification || ''}
                onChange={(e) => handleChange('google_site_verification', e.target.value)}
                placeholder="ABC123def456..."
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1">Verification code from Google Search Console</p>
            </div>
          </div>
        </div>

        {/* SEO Tips */}
        <div className="bg-zinc-50 rounded-xl border border-zinc-300 p-6">
          <h3 className="text-lg font-bold text-zinc-900 mb-3">💡 SEO Tips</h3>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li className="flex items-start gap-2">
              <span className="text-zinc-900 font-bold">•</span>
              <span>Keep your meta title under 60 characters to avoid truncation in search results</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-900 font-bold">•</span>
              <span>Write compelling meta descriptions between 150-160 characters</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-900 font-bold">•</span>
              <span>Use relevant keywords naturally - don't stuff them</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-900 font-bold">•</span>
              <span>Update your OG image regularly to keep social shares fresh</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-900 font-bold">•</span>
              <span>Monitor your Google Analytics to understand your audience</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
