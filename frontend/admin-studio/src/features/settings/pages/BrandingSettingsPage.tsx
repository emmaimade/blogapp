import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, AlertCircle, Palette, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

interface BrandingSettingsData {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string;
  favicon_url: string;
  font_heading: string;
  font_body: string;
}

const defaultBrandingSettings: BrandingSettingsData = {
  primary_color: '#9333EA',
  secondary_color: '#18181B',
  accent_color: '#A855F7',
  logo_url: '',
  favicon_url: '',
  font_heading: 'Inter',
  font_body: 'Inter',
};

const hexColorPattern = /^#(?:[0-9A-F]{3}){1,2}$/i;

const getSafeHexColor = (value: string | undefined, fallback: string) => (
  value && hexColorPattern.test(value) ? value : fallback
);

export const BrandingSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const { data: settings = defaultBrandingSettings, isLoading } = useQuery<BrandingSettingsData>({
    queryKey: ['brandingSettings', activeBlog?.id],
    queryFn: async () => {
      let data: any = {};
      try {
        const res = await api.get('/settings/branding');
        data = res.data || {};
      } catch (error) {
        // Fallback
      }
      return {
        ...defaultBrandingSettings,
        ...data,
        logo_url: data.logo_url || activeBlog?.logo_url || '',
        favicon_url: data.favicon_url || activeBlog?.favicon_url || '',
      };
    },
    enabled: !!activeBlog?.id,
  });

  const [formData, setFormData] = useState<BrandingSettingsData>(defaultBrandingSettings);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/branding', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandingSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allSettings'] });
      toast.success('Branding settings saved successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    }
  });

  const uploadAssetMutation = useMutation({
    mutationFn: async ({
      file,
      type,
    }: {
      file: File;
      type: 'logo' | 'favicon';
    }) => {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint =
        type === 'logo' ? '/settings/branding/upload-logo' : '/settings/branding/upload-favicon';

      const res = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { type, url: res.data.url as string };
    },
    onSuccess: ({ type, url }) => {
      if (type === 'logo') {
        handleChange('logo_url', url);
        toast.success('Logo uploaded successfully');
      } else {
        handleChange('favicon_url', url);
        toast.success('Favicon uploaded successfully');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleChange = (field: keyof BrandingSettingsData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (file: File | undefined, type: 'logo' | 'favicon') => {
    if (!file) return;
    uploadAssetMutation.mutate({ file, type });
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
            <div className="grid md:grid-cols-2 gap-4">
              {[...Array(index === 0 ? 3 : 2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-12 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
                  <div className="h-3 w-48 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const primaryColor = getSafeHexColor(formData.primary_color, defaultBrandingSettings.primary_color);
  const secondaryColor = getSafeHexColor(formData.secondary_color, defaultBrandingSettings.secondary_color);
  const accentColor = getSafeHexColor(formData.accent_color, defaultBrandingSettings.accent_color);

  const isDirty = settings && (
    formData.primary_color !== settings.primary_color ||
    formData.secondary_color !== settings.secondary_color ||
    formData.accent_color !== settings.accent_color ||
    formData.logo_url !== settings.logo_url ||
    formData.favicon_url !== settings.favicon_url ||
    formData.font_heading !== settings.font_heading ||
    formData.font_body !== settings.font_body
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
          <p className="font-bold mb-1">ðŸŽ¨ Visual Identity</p>
          <p>Customize your blog's colors, logo, and typography. These settings affect the entire site.</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Color Scheme */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Palette size={20} className="text-zinc-900" />
            Color Scheme
          </h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Primary Color
              </label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primary_color || '#9333EA'}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  placeholder="#9333EA"
                  className="min-w-0 flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Main brand color (buttons, links)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Secondary Color
              </label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-300 cursor-pointer"
                />
                                <input
                  type="text"
                  value={formData.secondary_color || '#18181B'}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  placeholder="#18181B"
                  className="min-w-0 flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Supporting color (gradients)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Accent Color
              </label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.accent_color || '#A855F7'}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  placeholder="#A855F7"
                  className="min-w-0 flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Highlight color (badges, tags)</p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-6 p-6 bg-zinc-50 rounded-xl">
            <p className="text-sm font-bold text-zinc-700 mb-4">Preview</p>
            <div className="flex gap-3 flex-wrap">
              <div
                className="px-6 py-3 rounded-lg text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                Primary Button
              </div>
              <div
                className="px-6 py-3 rounded-lg text-white font-bold"
                style={{ 
                  background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
                }}
              >
                Gradient Button
              </div>
              <div
                className="px-4 py-2 rounded-full text-sm font-bold"
                style={{ 
                  backgroundColor: `${accentColor}20`,
                  color: accentColor
                }}
              >
                Accent Badge
              </div>
            </div>
          </div>
        </div>

        {/* Logo & Favicon */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Logo & Favicon</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Logo URL
              </label>
              <div className="space-y-3">
                <input
                  type="url"
                  value={formData.logo_url || ''}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadAssetMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadAssetMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    Upload from device
                  </button>
                  <span className="text-xs text-zinc-500">Or paste a hosted image URL above</span>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(e) => {
                    handleFileUpload(e.target.files?.[0], 'logo');
                    e.target.value = '';
                  }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Upload from your computer or use a direct logo URL. PNG and SVG are recommended.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Favicon URL
              </label>
              <div className="space-y-3">
                <input
                  type="url"
                  value={formData.favicon_url || ''}
                  onChange={(e) => handleChange('favicon_url', e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadAssetMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadAssetMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    Upload from device
                  </button>
                  <span className="text-xs text-zinc-500">Or paste a hosted favicon URL above</span>
                </div>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".ico,.png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(e) => {
                    handleFileUpload(e.target.files?.[0], 'favicon');
                    e.target.value = '';
                  }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Upload from your computer or use a direct favicon URL. ICO, PNG, and SVG work best.</p>
            </div>

            {/* Preview */}
            {(formData.logo_url || formData.favicon_url) && (
              <div className="mt-4 p-4 bg-zinc-50 rounded-xl">
                <p className="text-sm font-bold text-zinc-700 mb-3">Preview</p>
                <div className="flex gap-6 items-center">
                  {formData.logo_url && (
                    <div>
                      <p className="text-xs text-zinc-600 mb-2">Logo</p>
                      <img 
                        src={formData.logo_url} 
                        alt="Logo preview" 
                        className="h-12 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {formData.favicon_url && (
                    <div>
                      <p className="text-xs text-zinc-600 mb-2">Favicon</p>
                      <img 
                        src={formData.favicon_url} 
                        alt="Favicon preview" 
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Typography */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Typography</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Heading Font
              </label>
              <select
                value={formData.font_heading || 'Inter'}
                onChange={(e) => handleChange('font_heading', e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Poppins">Poppins</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Merriweather">Merriweather</option>
                <option value="Lora">Lora</option>
                <option value="Open Sans">Open Sans</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Used for titles and headings</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">
                Body Font
              </label>
              <select
                value={formData.font_body || 'Inter'}
                onChange={(e) => handleChange('font_body', e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Source Sans Pro">Source Sans Pro</option>
                <option value="Raleway">Raleway</option>
                <option value="PT Sans">PT Sans</option>
                <option value="Nunito">Nunito</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Used for body text and paragraphs</p>
            </div>
          </div>

          {/* Typography Preview */}
          <div className="mt-6 p-6 bg-zinc-50 rounded-xl">
            <p className="text-sm font-bold text-zinc-700 mb-4">Preview</p>
            <h1 
              className="text-4xl font-black mb-3"
              style={{ fontFamily: formData.font_heading || 'Inter' }}
            >
              This is a Heading
            </h1>
            <p 
              className="text-base text-zinc-600"
              style={{ fontFamily: formData.font_body || 'Inter' }}
            >
              This is body text. The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
