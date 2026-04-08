import React, { useState } from 'react';
import { Mail, MapPin, Clock, Phone, Send, Github, Twitter, Linkedin, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/blogApi';

interface ContactSettingsData {
  contact_email: string;
  location: string;
  response_time: string;
  phone: string | null;
  show_social_links: boolean;
  show_faq: boolean;
  social_links: { [key: string]: string | undefined };
  faqs: { question: string; answer: string }[];
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

export const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: settings = defaultSettings } = useQuery<ContactSettingsData>({
    queryKey: ['settings', 'contact'],
    queryFn: async () => normalizeContactSettings((await api.get('/settings/contact')).data),
    staleTime: 1000 * 60 * 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call (replace with real endpoint later)
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      toast.success('Message sent successfully!');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setIsSuccess(false), 5000);
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black text-slate-900 mb-4">Get In Touch</h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Have a question or just want to say hello? I'd love to hear from you.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-12">
        {/* Contact Form */}
        <div className="md:col-span-3">
          {isSuccess ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-600" size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">Message Sent!</h3>
              <p className="text-slate-600 mb-6">
                Thanks for reaching out. I'll get back to you soon.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="bg-green-600 text-white px-8 py-3 rounded-full font-bold hover:bg-green-700 transition-all"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form fields remain the same as your original */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="What's this about?"
                  required
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell me more..."
                  rows={8}
                  required
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Contact Info Sidebar */}
        <div className="md:col-span-2 space-y-6">
          {/* Email */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 border border-indigo-100">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Mail className="text-white" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Email</h3>
            <a href={`mailto:${settings.contact_email}`} className="text-indigo-600 hover:text-indigo-700 font-medium break-all">
              {settings.contact_email}
            </a>
          </div>

          {/* Response Time */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 border border-purple-100">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
              <Clock className="text-white" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Response Time</h3>
            <p className="text-slate-600">{settings.response_time}</p>
          </div>

          {/* Location */}
          <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-3xl p-6 border border-pink-100">
            <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center mb-4">
              <MapPin className="text-white" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Location</h3>
            <p className="text-slate-600">{settings.location}</p>
          </div>

          {/* Phone (if provided) */}
          {settings.phone && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Phone className="text-white" size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Phone</h3>
              <a href={`tel:${settings.phone}`} className="text-emerald-600 hover:text-emerald-700 font-medium">
                {settings.phone}
              </a>
            </div>
          )}

          {/* Social Links */}
          {settings.show_social_links && Object.keys(settings.social_links).length > 0 && (
            <div className="bg-slate-900 rounded-3xl p-6 text-white">
              <h3 className="text-lg font-bold mb-4">Connect on Social</h3>
              <div className="space-y-3">
                {Object.entries(settings.social_links).map(([platform, url]) => {
                  if (!url) return null;
                  const Icon = platform === 'github' ? Github : platform === 'twitter' ? Twitter : Linkedin;
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
                    >
                      <Icon size={20} />
                      <span className="font-medium capitalize">{platform}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional FAQ */}
          {settings.show_faq && settings.faqs.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Questions?</h3>
              <div className="space-y-4 text-sm">
                {settings.faqs.map((faq, i) => (
                  <div key={i}>
                    <p className="font-bold text-slate-900 mb-1">{faq.question}</p>
                    <p className="text-slate-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
