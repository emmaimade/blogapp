import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, AlertCircle, Palette, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

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
  primary_color: '#4F46E5',
  secondary_color: '#7C3AED',
  accent_color: '#EC4899',
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
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const { data: settings = defaultBrandingSettings, isLoading } = useQuery<BrandingSettingsData>({
    queryKey: ['brandingSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/branding');
        return res.data;
      } catch (error) {
        return defaultBrandingSettings;
      }
    }
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={40} />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const primaryColor = getSafeHexColor(formData.primary_color, defaultBrandingSettings.primary_color);
  const secondaryColor = getSafeHexColor(formData.secondary_color, defaultBrandingSettings.secondary_color);
  const accentColor = getSafeHexColor(formData.accent_color, defaultBrandingSettings.accent_color);

  return (
    <div className="max-w-4xl">
      
      {/* Info Banner */}
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" size={20} />
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <p className="font-bold mb-1">🎨 Visual Identity</p>
          <p>Customize your blog's colors, logo, and typography. These settings affect the entire site.</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Color Scheme */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Palette size={20} className="text-indigo-600" />
            Color Scheme
          </h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Primary Color
              </label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primary_color || '#4F46E5'}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  placeholder="#4F46E5"
                  className="min-w-0 flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Main brand color (buttons, links)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Secondary Color
              </label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondary_color || '#7C3AED'}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  placeholder="#7C3AED"
                  className="min-w-0 flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Supporting color (gradients)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Accent Color
              </label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.accent_color || '#EC4899'}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  placeholder="#EC4899"
                  className="min-w-0 flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Highlight color (badges, tags)</p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-6 p-6 bg-slate-50 rounded-xl">
            <p className="text-sm font-bold text-slate-700 mb-4">Preview</p>
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
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Logo & Favicon</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Logo URL
              </label>
              <div className="space-y-3">
                <input
                  type="url"
                  value={formData.logo_url || ''}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadAssetMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadAssetMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    Upload from device
                  </button>
                  <span className="text-xs text-slate-500">Or paste a hosted image URL above</span>
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
              <p className="text-xs text-slate-500 mt-1">Upload from your computer or use a direct logo URL. PNG and SVG are recommended.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Favicon URL
              </label>
              <div className="space-y-3">
                <input
                  type="url"
                  value={formData.favicon_url || ''}
                  onChange={(e) => handleChange('favicon_url', e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadAssetMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadAssetMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    Upload from device
                  </button>
                  <span className="text-xs text-slate-500">Or paste a hosted favicon URL above</span>
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
              <p className="text-xs text-slate-500 mt-1">Upload from your computer or use a direct favicon URL. ICO, PNG, and SVG work best.</p>
            </div>

            {/* Preview */}
            {(formData.logo_url || formData.favicon_url) && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-bold text-slate-700 mb-3">Preview</p>
                <div className="flex gap-6 items-center">
                  {formData.logo_url && (
                    <div>
                      <p className="text-xs text-slate-600 mb-2">Logo</p>
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
                      <p className="text-xs text-slate-600 mb-2">Favicon</p>
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
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Typography</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Heading Font
              </label>
              <select
                value={formData.font_heading || 'Inter'}
                onChange={(e) => handleChange('font_heading', e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
              <p className="text-xs text-slate-500 mt-1">Used for titles and headings</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Body Font
              </label>
              <select
                value={formData.font_body || 'Inter'}
                onChange={(e) => handleChange('font_body', e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
              <p className="text-xs text-slate-500 mt-1">Used for body text and paragraphs</p>
            </div>
          </div>

          {/* Typography Preview */}
          <div className="mt-6 p-6 bg-slate-50 rounded-xl">
            <p className="text-sm font-bold text-slate-700 mb-4">Preview</p>
            <h1 
              className="text-4xl font-black mb-3"
              style={{ fontFamily: formData.font_heading || 'Inter' }}
            >
              This is a Heading
            </h1>
            <p 
              className="text-base text-slate-600"
              style={{ fontFamily: formData.font_body || 'Inter' }}
            >
              This is body text. The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
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
