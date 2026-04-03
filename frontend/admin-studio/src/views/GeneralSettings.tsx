import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Globe, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

export const GeneralSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['generalSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/general');
        return res.data;
      } catch {
        return {
          site_name: 'Inko',
          site_tagline: 'Your ideas, amplified',
          site_description: 'A modern blog CMS for sharing your stories and ideas',
          timezone: 'UTC',
          language: 'en',
          posts_per_page: 10,
        };
      }
    },
  });

  const [formData, setFormData] = useState(settings || {});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/general', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generalSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allSettings'] });
      toast.success('General settings saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-indigo-600 dark:text-indigo-400" size={40} />
          <p className="text-slate-600 dark:text-slate-300">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page max-w-4xl">
      {/* Info Banner */}
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" size={20} />
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <p className="mb-1 font-bold">Site-wide settings</p>
          <p>These settings apply across your entire blog and affect how it appears to visitors.</p>
        </div>
      </div>

      {/* General Settings */}
      <div className="space-y-6">
        <div className="admin-section p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Globe size={20} className="text-indigo-600 dark:text-indigo-400" />
            Site Identity
          </h2>

          <div className="space-y-4">
            <div className="admin-form-field">
              <label className="admin-form-label">Site Name</label>
              <input
                type="text"
                value={(formData as any).site_name || ''}
                onChange={(e) => handleChange('site_name', e.target.value)}
                placeholder="Inko"
                className="admin-input"
              />
              <p className="admin-form-help">Your blog name as shown in the navigation, footer, and browser title.</p>
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Tagline</label>
              <input
                type="text"
                value={(formData as any).site_tagline || ''}
                onChange={(e) => handleChange('site_tagline', e.target.value)}
                placeholder="Your ideas, amplified"
                className="admin-input"
              />
              <p className="admin-form-help">A short phrase that describes the site’s positioning.</p>
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Site Description</label>
              <textarea
                value={(formData as any).site_description || ''}
                onChange={(e) => handleChange('site_description', e.target.value)}
                placeholder="A modern blog CMS for sharing your stories and ideas"
                rows={4}
                className="admin-textarea"
              />
              <p className="admin-form-help">Used for SEO metadata and social sharing previews.</p>
            </div>
          </div>
        </div>

        <div className="admin-section p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Display Options</h2>

          <div className="space-y-4">
            <div className="admin-form-field">
              <label className="admin-form-label">Posts Per Page</label>
              <input
                type="number"
                min="1"
                max="50"
                value={(formData as any).posts_per_page || 10}
                onChange={(e) => handleChange('posts_per_page', parseInt(e.target.value, 10))}
                className="admin-input"
              />
              <p className="admin-form-help">Set the number of posts shown on paginated listing pages.</p>
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Timezone</label>
              <select
                value={(formData as any).timezone || 'UTC'}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className="admin-select"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
              <p className="admin-form-help">Used when rendering publish and update timestamps.</p>
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Language</label>
              <select
                value={(formData as any).language || 'en'}
                onChange={(e) => handleChange('language', e.target.value)}
                className="admin-select"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
              <p className="admin-form-help">Default language for public-facing content and labels.</p>
            </div>
          </div>
        </div>

        <div className="admin-section sticky bottom-0 p-4">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="admin-btn admin-btn-primary flex w-full items-center justify-center gap-2 px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50"
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
