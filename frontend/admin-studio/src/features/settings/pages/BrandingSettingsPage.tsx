import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, Upload, X, Palette, Image } from 'lucide-react';
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

const getSafeHexColor = (value: string | undefined, fallback: string) =>
  value && hexColorPattern.test(value) ? value : fallback;

export const BrandingSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const { data: settings = defaultBrandingSettings } = useQuery<BrandingSettingsData>({
    queryKey: ['brandingSettings', activeBlog?.id],
    queryFn: async () => {
      let data: any = {};
      try {
        const res = await api.get('/settings/branding');
        data = res.data || {};
      } catch {}
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
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setLogoPreview(settings.logo_url);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: BrandingSettingsData) => api.post('/settings/branding', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandingSettings'] });
      toast.success('Branding settings saved successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    },
  });

  const uploadAssetMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'logo' | 'favicon' }) => {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const endpoint = type === 'logo' 
        ? '/settings/branding/upload-logo' 
        : '/settings/branding/upload-favicon';

      const res = await api.post(endpoint, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { type, url: res.data.url as string };
    },
    onSuccess: ({ type, url }) => {
      if (type === 'logo') {
        setFormData(prev => ({ ...prev, logo_url: url }));
        setLogoPreview(url);
        toast.success('Logo uploaded successfully');
      } else {
        setFormData(prev => ({ ...prev, favicon_url: url }));
        toast.success('Favicon uploaded successfully');
      }
    },
    onError: () => toast.error('Upload failed'),
  });

  const handleSave = () => saveMutation.mutate(formData);

  const handleFileUpload = (file: File | undefined, type: 'logo' | 'favicon') => {
    if (!file) return;
    uploadAssetMutation.mutate({ file, type });
  };

  const handleLogoRemove = () => {
    setFormData(prev => ({ ...prev, logo_url: '' }));
    setLogoPreview('');
  };

  const handleChange = (field: keyof BrandingSettingsData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Computed safe colors for preview
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
      {isDirty && (
        <div className="fixed top-[76px] right-6 md:right-10 z-50">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white shadow-lg hover:bg-zinc-800 disabled:opacity-70"
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            Save Changes
          </button>
        </div>
      )}

      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-zinc-900" size={20} />
        <div>
          <p className="font-bold">Visual Identity</p>
          <p className="text-sm text-zinc-600">This determines how your blog looks to visitors.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Logo Section */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Image size={22} /> Logo
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer hover:border-violet-400 ${isDraggingLogo ? 'border-violet-500 bg-violet-50' : 'border-zinc-300'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
              onDragLeave={() => setIsDraggingLogo(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingLogo(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file, 'logo');
              }}
              onClick={() => logoInputRef.current?.click()}
            >
              <div className="mx-auto w-20 h-20 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6">
                <Upload size={40} className="text-zinc-400" />
              </div>
              <p className="font-semibold text-lg">Upload your logo</p>
              <p className="text-sm text-zinc-500 mt-2">PNG, JPG, SVG • Recommended: 200×60px</p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'logo');
                }}
              />
            </div>

            {/* Live Preview */}
            <div>
              <p className="text-sm font-semibold text-zinc-600 mb-3">How it will look in navbar</p>
              <div className="border border-zinc-200 rounded-2xl p-6 bg-white min-h-[160px] flex items-center justify-center shadow-sm">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-16 object-contain drop-shadow-sm"
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-4xl font-black text-zinc-200 tracking-tighter">Your Logo</div>
                    <p className="text-xs text-zinc-400 mt-3">Upload a logo to see live preview</p>
                  </div>
                )}
              </div>

              {logoPreview && (
                <button
                  onClick={handleLogoRemove}
                  className="mt-4 text-red-600 hover:text-red-700 text-sm flex items-center gap-1.5"
                >
                  <X size={16} /> Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold mb-4">Favicon</h2>
          <div className="flex gap-4">
            <input
              ref={faviconInputRef}
              type="file"
              accept=".ico,.png,.jpg,.jpeg,.webp,.svg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'favicon');
              }}
            />
            <button
              onClick={() => faviconInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-300 hover:bg-zinc-50"
            >
              <Upload size={18} />
              Upload Favicon
            </button>
            {formData.favicon_url && (
              <div className="flex items-center gap-3">
                <img src={formData.favicon_url} alt="Favicon" className="h-8 w-8 object-contain" />
                <button 
                  onClick={() => setFormData(p => ({ ...p, favicon_url: '' }))} 
                  className="text-red-500 text-sm"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2">Recommended: 512×512px or .ico format</p>
        </div>

        {/* Color Scheme */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Palette size={20} className="text-zinc-900" />
            Color Scheme
          </h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Primary Color</label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Secondary Color</label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Accent Color</label>
              <div className="flex gap-3 items-center min-w-0">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="h-12 w-12 shrink-0 rounded-lg border border-zinc-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.accent_color}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                />
              </div>
            </div>
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
