import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';

interface FAQItem {
  question: string;
  answer: string;
}

interface ContactSettingsData {
  contact_email: string;
  location: string;
  response_time: string;
  phone: string | null;
  show_social_links: boolean;
  show_faq: boolean;
  social_links: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    facebook?: string;
  };
  faqs: FAQItem[];
}

const defaultSettings: ContactSettingsData = {
  contact_email: 'hello@inko.blog',
  location: 'San Francisco, CA',
  response_time: 'Usually within 24-48 hours',
  phone: null,
  show_social_links: true,
  show_faq: true,
  social_links: {},
  faqs: [],
};

const normalizeContactSettings = (
  settings?: Partial<ContactSettingsData> | null
): ContactSettingsData => ({
  ...defaultSettings,
  ...settings,
  phone: settings?.phone ?? null,
  show_social_links: settings?.show_social_links ?? true,
  social_links: settings?.social_links ?? {},
  faqs: settings?.faqs ?? [],
});

export const ContactSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings = defaultSettings, isLoading } = useQuery<ContactSettingsData>({
    queryKey: ['settings', 'contact'],
    queryFn: async () => normalizeContactSettings((await api.get('/settings/contact')).data),
    staleTime: 1000 * 60 * 5,
  });

  const [formData, setFormData] = useState<ContactSettingsData>(defaultSettings);

  useEffect(() => {
    if (settings) setFormData(normalizeContactSettings(settings));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (payload: ContactSettingsData) =>
      (await api.post('/settings/contact', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'contact'] });
      toast.success('Contact settings saved successfully!');
    },
    onError: () => toast.error('Failed to save contact settings'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const updateSocial = (key: keyof ContactSettingsData['social_links'], value: string) => {
    setFormData(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [key]: value || undefined },
    }));
  };

  const addFaq = () => {
    setFormData(prev => ({
      ...prev,
      faqs: [...prev.faqs, { question: '', answer: '' }],
    }));
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFormData(prev => {
      const newFaqs = [...prev.faqs];
      newFaqs[index] = { ...newFaqs[index], [field]: value };
      return { ...prev, faqs: newFaqs };
    });
  };

  const removeFaq = (index: number) => {
    setFormData(prev => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return <div className="py-12 text-center text-zinc-500">Loading contact settings...</div>;
  }

  return (
    <div className="max-w-4xl">
      <div className="admin-note mb-8 flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-900" size={20} />
        <div className="text-sm text-zinc-700 dark:text-zinc-200">
          <p className="font-bold mb-1">Contact Page Settings</p>
          <p>Control what visitors see on your public contact page and how they can reach you.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Contact Info */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Mail size={20} className="text-zinc-900" /> Contact Information
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">Primary email address shown on the contact page.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Phone (optional)</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value || null }))}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-zinc-500 mt-1">Optional phone number for direct contact.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">City, region, or remote availability for visitors.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Expected Response Time</label>
              <input
                type="text"
                value={formData.response_time}
                onChange={(e) => setFormData(prev => ({ ...prev, response_time: e.target.value }))}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">Set expectations for how quickly you usually reply.</p>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900">Social Links</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_social_links}
                onChange={(e) => setFormData(prev => ({ ...prev, show_social_links: e.target.checked }))}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary"
              />
              <span className="text-sm font-medium text-zinc-700">Show Social Links</span>
            </label>
          </div>
          {formData.show_social_links && (
            <div className="grid md:grid-cols-2 gap-4">
              {(['github', 'twitter', 'linkedin', 'instagram', 'youtube', 'facebook'] as const).map((platform) => (
                <div key={platform}>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 capitalize">{platform}</label>
                  <input
                    type="url"
                    value={formData.social_links[platform] || ''}
                    onChange={(e) => updateSocial(platform, e.target.value)}
                    placeholder={`https://www.${platform}.com/yourusername`}
                    className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAQ Section (Optional) */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900">FAQ Section</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_faq}
                onChange={(e) => setFormData(prev => ({ ...prev, show_faq: e.target.checked }))}
                className="w-5 h-5 text-zinc-900 rounded border-zinc-300 focus:ring-primary"
              />
              <span className="text-sm font-medium text-zinc-700">Show FAQ on Contact page</span>
            </label>
          </div>

          {formData.show_faq && (
            <>
              <button
                type="button"
                onClick={addFaq}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-bold hover:bg-purple-700 transition-all mb-6"
              >
                <Plus size={18} /> Add FAQ Item
              </button>

              <div className="space-y-4">
                {formData.faqs.map((faq, index) => (
                  <div key={index} className="flex gap-4 rounded-xl border border-zinc-200 p-5">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => updateFaq(index, 'question', e.target.value)}
                        placeholder="Question (e.g. Open for freelance?)"
                        className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                      <textarea
                        value={faq.answer}
                        onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                        placeholder="Answer"
                        rows={3}
                        className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFaq(index)}
                      className="text-red-500 hover:text-red-700 self-start mt-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="sticky bottom-0 w-full flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Saving...' : (
            <>
              <Save size={20} /> Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
};
