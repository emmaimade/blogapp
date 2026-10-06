import React, { useEffect, useRef, useState } from 'react';
import { Mail, MapPin, Clock, Phone, Send, CheckCircle, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/blogApi';
import { getApiErrorMessage } from '../api/errors';
import { usePageMeta } from '../hooks/usePageMeta';
import { getActiveSocialLinks } from '../utils/social';

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

// Unset fields stay empty and their rows are hidden — a tenant's page must
// never show placeholder (or the platform's) contact details as if they were real.
const defaultSettings: ContactSettingsData = {
  contact_email: '',
  location: '',
  response_time: '',
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
  contact_email: settings?.contact_email ?? '',
  location: settings?.location ?? '',
  response_time: settings?.response_time ?? '',
  phone: settings?.phone ?? null,
  show_social_links: settings?.show_social_links ?? true,
  show_faq: settings?.show_faq ?? true,
  social_links: settings?.social_links ?? {},
  faqs: settings?.faqs ?? [],
});

const inputClass =
  'w-full px-4 py-3 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:border-primary focus:bg-white outline-none transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:focus:bg-zinc-800';

const labelClass = 'block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2';

const detailLinkClass =
  'font-medium text-primary hover:text-primary-hover hover:underline underline-offset-2 break-all';

export const Contact: React.FC = () => {
  usePageMeta('Contact');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const successRef = useRef<HTMLDivElement>(null);

  const { data: settings = defaultSettings } = useQuery<ContactSettingsData>({
    queryKey: ['settings', 'contact'],
    queryFn: async () => normalizeContactSettings((await api.get('/settings/contact')).data),
    staleTime: 1000 * 60 * 5,
  });

  // The form unmounts on success, so move focus to the confirmation instead of
  // letting it fall back to <body>.
  useEffect(() => {
    if (isSuccess) successRef.current?.focus();
  }, [isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post('/settings/contact/message', formData);
      setIsSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send message. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const activeSocialLinks = settings.show_social_links
    ? getActiveSocialLinks(settings.social_links)
    : [];

  // Half-filled FAQ entries from the admin editor shouldn't render as blank rows.
  const visibleFaqs = settings.show_faq
    ? settings.faqs.filter((faq) => faq.question.trim() && faq.answer.trim())
    : [];

  const hasDetails = Boolean(settings.contact_email || settings.phone || settings.location);
  const hasSidebar = hasDetails || activeSocialLinks.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 mb-4">Get in touch</h1>
        <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Questions, feedback or ideas — send a message.
        </p>
      </div>

      <div className={hasSidebar ? 'grid md:grid-cols-5 gap-12' : 'max-w-2xl mx-auto'}>
        {/* Contact Form */}
        <div className={hasSidebar ? 'md:col-span-3' : undefined}>
          {isSuccess ? (
            <div
              ref={successRef}
              tabIndex={-1}
              role="status"
              className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center outline-none dark:bg-green-950/30 dark:border-green-900"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 dark:bg-green-900/40">
                <CheckCircle className="text-green-600 dark:text-green-400" size={40} />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Message sent</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Thanks for reaching out. We'll get back to you soon.
              </p>
              <button onClick={() => setIsSuccess(false)} className="btn-secondary">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="contact-name" className={labelClass}>Your Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className={labelClass}>Email Address</label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className={labelClass}>Subject</label>
                <input
                  id="contact-subject"
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="What's this about?"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="contact-message" className={labelClass}>Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell me more..."
                  rows={8}
                  required
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Send message
                    </>
                  )}
                </button>
                {settings.response_time && (
                  <p className="mt-3 flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <Clock size={16} aria-hidden="true" />
                    <span>{settings.response_time}</span>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Contact Details — shown above the form on mobile so the email is reachable without scrolling */}
        {hasSidebar && (
          <aside className="md:col-span-2 order-first md:order-none">
            <div className="card p-6">
              {hasDetails && (
                <>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">Contact details</h2>
                  <dl className="space-y-4">
                    {settings.contact_email && (
                      <div className="flex items-start gap-3">
                        <Mail size={20} className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <dt className="text-sm text-zinc-500 dark:text-zinc-400">Email</dt>
                          <dd>
                            <a href={`mailto:${settings.contact_email}`} className={detailLinkClass}>
                              {settings.contact_email}
                            </a>
                          </dd>
                        </div>
                      </div>
                    )}
                    {settings.phone && (
                      <div className="flex items-start gap-3">
                        <Phone size={20} className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <dt className="text-sm text-zinc-500 dark:text-zinc-400">Phone</dt>
                          <dd>
                            <a href={`tel:${settings.phone}`} className={detailLinkClass}>
                              {settings.phone}
                            </a>
                          </dd>
                        </div>
                      </div>
                    )}
                    {settings.location && (
                      <div className="flex items-start gap-3">
                        <MapPin size={20} className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <dt className="text-sm text-zinc-500 dark:text-zinc-400">Location</dt>
                          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{settings.location}</dd>
                        </div>
                      </div>
                    )}
                  </dl>
                </>
              )}

              {activeSocialLinks.length > 0 && (
                <div className={hasDetails ? 'mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800' : undefined}>
                  <h2 className={hasDetails
                    ? 'text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3'
                    : 'text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4'}
                  >
                    Connect on social
                  </h2>
                  <ul className="space-y-2">
                    {activeSocialLinks.map(({ key, url, label, icon: Icon }) => {
                      return (
                        <li key={key}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-xl text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                          >
                            <Icon size={18} aria-hidden="true" />
                            <span className="font-medium">{label}</span>
                            <span className="sr-only">(opens in new tab)</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* FAQ */}
      {visibleFaqs.length > 0 && (
        <section className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-8 text-center">
            Frequently asked questions
          </h2>
          <div className="card overflow-hidden">
            {visibleFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              const panelId = `contact-faq-panel-${index}`;
              return (
                <div key={index} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800"
                    >
                      <span className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{faq.question}</span>
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className={`shrink-0 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  <div id={panelId} hidden={!isOpen} className="px-6 pb-5">
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
