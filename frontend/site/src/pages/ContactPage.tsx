import { Send, ArrowRight, Clock, LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaqList } from '../shared/components/FaqList';
import { PageHero } from '../shared/components/PageHero';
import { PrimaryCta } from '../shared/components/PrimaryCta';
import { usePageMeta } from '../shared/hooks/usePageMeta';
import { API_URL, ADMIN_STUDIO_URL } from '../shared/config';
import { TRIAL_DAYS } from '../shared/plans';

const faqs = [
  {
    question: 'How quickly will you reply?',
    answer: 'We read every message and reply within 1–2 business days.',
  },
  {
    question: 'I already have an account. Where do I get help?',
    answer: 'Open the support desk from inside the Inko studio. Your request is linked to your workspace, so we can help faster and you can track it until it is resolved.',
  },
  {
    question: 'Can I run more than one blog?',
    answer: 'Yes. Each workspace is a separate blog with its own team, branding and content, and each one has its own plan.',
  },
  {
    question: 'How do payments work?',
    answer: 'Payments are processed securely by Paystack in Nigerian naira. See the pricing page for plans and billing details.',
  },
];

const emptyForm = { name: '', email: '', company: '', subject: '', message: '' };

const inputClass =
  'w-full px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-primary focus:outline-none transition-colors bg-white';

export const ContactPage = () => {
  usePageMeta(
    'Contact',
    'Questions about plans, want a walkthrough, or need a hand? Send the Inko team a message.'
  );

  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // A fresh edit means the last result no longer describes what's in the form.
    if (submitStatus !== 'idle') setSubmitStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axios.post(`${API_URL}/contact/`, formData);
      setSubmitStatus('success');
      setFormData(emptyForm);
    } catch (error) {
      console.error('Contact form submission failed', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-0">
      <PageHero
        title="Let's talk about"
        highlight="your blog"
        description="Questions about plans, want a walkthrough, or need a hand? Send us a message and we'll get back to you."
      />

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16">
          <div>
            <h2 className="font-display text-4xl text-zinc-900 mb-6">Send us a message</h2>
            <p className="text-zinc-600 mb-8 leading-relaxed">
              Fill out the form and our team will get back to you by email.
            </p>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-accent flex items-center justify-center">
                  <Clock className="text-primary" size={22} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 mb-1">Response time</h3>
                  <p className="text-sm text-zinc-600">We reply within 1–2 business days.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-accent flex items-center justify-center">
                  <LifeBuoy className="text-primary" size={22} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 mb-1">Already a customer?</h3>
                  <p className="text-sm text-zinc-600 mb-2">
                    The support desk inside the studio is the fastest way to get help with your workspace.
                  </p>
                  <a
                    href={`${ADMIN_STUDIO_URL}/admin/support-tickets`}
                    className="text-primary hover:text-primary-hover font-semibold text-sm inline-flex items-center gap-1"
                  >
                    Open the support desk <ArrowRight size={14} />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-zinc-900 mb-3">Just want to try it?</h3>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover hover:shadow-lg transition-all"
                >
                  Start free
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-50 rounded-2xl p-8 border-2 border-zinc-200">
            <div aria-live="polite">
              {submitStatus === 'success' && (
                <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  ✓ Message sent. We'll be in touch within 1–2 business days.
                </div>
              )}
              {submitStatus === 'error' && (
                <div role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  ✗ We couldn't send your message. Please check your connection and try again.
                </div>
              )}
            </div>

            <div>
              <label htmlFor="contact-name" className="block text-sm font-bold text-zinc-900 mb-2">
                Full name *
              </label>
              <input
                id="contact-name"
                type="text"
                name="name"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ada Lovelace"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-bold text-zinc-900 mb-2">
                Email *
              </label>
              <input
                id="contact-email"
                type="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact-company" className="block text-sm font-bold text-zinc-900 mb-2">
                Company
              </label>
              <input
                id="contact-company"
                type="text"
                name="company"
                autoComplete="organization"
                value={formData.company}
                onChange={handleChange}
                placeholder="Acme Inc"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="block text-sm font-bold text-zinc-900 mb-2">
                Subject *
              </label>
              <select
                id="contact-subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="">Select a subject</option>
                <option value="demo">Schedule a demo</option>
                <option value="sales">Plans & pricing</option>
                <option value="support">Support</option>
                <option value="partnership">Partnership</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-bold text-zinc-900 mb-2">
                Message *
              </label>
              <textarea
                id="contact-message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell us more about your inquiry..."
                required
                rows={5}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={20} aria-hidden="true" />
                  Send message
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-zinc-900 mb-4">Common questions</h2>
            <p className="text-zinc-600">Quick answers before you write in.</p>
          </div>

          <FaqList faqs={faqs} />
        </div>
      </section>

      <PrimaryCta
        title="Ready to get started?"
        description={`Start free, or try Pro or Team free for ${TRIAL_DAYS} days.`}
        ctaText="Start free"
        ctaLink="/signup"
        className="bg-white"
      />
    </div>
  );
};
