import { Mail, Phone, MapPin, Send, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // In production, this would send to your backend
      console.log('Form submitted:', formData);
      setSubmitStatus('success');
      setFormData({ name: '', email: '', company: '', subject: '', message: '' });
      
      // Reset after 3 seconds
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (error) {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_right,_rgba(124,58,237,0.18),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_left,_rgba(124,58,237,0.12),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_center,_rgba(139,92,246,0.06),_transparent)]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-accent-border mb-8">
            <span className="text-sm font-semibold text-accent-text">
              Get in touch
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-black text-zinc-900 mb-6 leading-[1.1]">
            Let's talk about{' '}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              your blog
            </span>
          </h1>
          
          <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto">
            Have questions? Want to schedule a demo? Our team is here to help you get the most out of INKO.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Contact Info Cards */}
            <div className="rounded-2xl border-2 border-zinc-200 p-8 hover:border-zinc-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <Mail className="text-primary" size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Email</h3>
              <p className="text-zinc-600 mb-4">
                Reach out to our team for support and inquiries.
              </p>
              <a
                href="mailto:hello@inko.blog"
                className="text-primary hover:text-primary-hover font-semibold text-sm"
              >
                hello@inko.blog
              </a>
            </div>

            <div className="rounded-2xl border-2 border-zinc-200 p-8 hover:border-zinc-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <Phone className="text-primary" size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Phone</h3>
              <p className="text-zinc-600 mb-4">
                Call our sales team for enterprise inquiries.
              </p>
              <a
                href="tel:+1-555-0123"
                className="text-primary hover:text-primary/80 font-semibold text-sm"
              >
                +1 (555) 0123
              </a>
            </div>

            <div className="rounded-2xl border-2 border-zinc-200 p-8 hover:border-zinc-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <MapPin className="text-primary" size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Office</h3>
              <p className="text-zinc-600 mb-4">
                Visit our headquarters.
              </p>
              <a
                href="#"
                className="text-primary hover:text-primary/80 font-semibold text-sm"
              >
                San Francisco, CA
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 mb-6">Send us a message</h2>
              <p className="text-zinc-600 mb-8 leading-relaxed">
                Fill out the form and our team will get back to you within 24 hours. For urgent matters, please call us directly.
              </p>

              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-zinc-900 mb-3">Response time</h4>
                  <p className="text-sm text-zinc-600">
                    ⚡ Average response: 2 hours
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 mb-3">Support hours</h4>
                  <p className="text-sm text-zinc-600">
                    Monday - Friday: 9 AM - 6 PM EST<br />
                    Saturday - Sunday: Closed
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 mb-3">Need help faster?</h4>
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Start free trial
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-50 rounded-2xl p-8 border-2 border-zinc-200">
                {/* Success Message */}
                {submitStatus === 'success' && (
                  <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-sm text-green-700">
                    ✓ Message sent successfully! We'll be in touch soon.
                  </div>
                )}

                {/* Error Message */}
                {submitStatus === 'error' && (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    ✗ Something went wrong. Please try again.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-2">
                    Full name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-primary focus:outline-none transition-colors bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-primary focus:outline-none transition-colors bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Acme Inc"
                    className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-primary focus:outline-none transition-colors bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-2">
                    Subject *
                  </label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-primary focus:outline-none transition-colors bg-white"
                  >
                    <option value="">Select a subject</option>
                    <option value="demo">Schedule a demo</option>
                    <option value="sales">Sales inquiry</option>
                    <option value="support">Support</option>
                    <option value="partnership">Partnership</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-2">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us more about your inquiry..."
                    required
                    rows={5}
                    className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 focus:border-primary focus:outline-none transition-colors bg-white resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-primary text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Send message
                    </>
                  )}
                </button>

                <p className="text-xs text-zinc-600 text-center">
                  We'll respond to your message within 24 hours.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-900 mb-4">Common questions</h2>
            <p className="text-zinc-600">Answers to frequently asked questions about INKO.</p>
          </div>

          <div className="space-y-6">
            {[
              {
                question: 'How long does a demo take?',
                answer: 'A typical demo takes 30-45 minutes. We walk you through INKO features and answer any questions specific to your use case.',
              },
              {
                question: 'Do you offer custom enterprise plans?',
                answer: 'Yes! For enterprise customers, we offer custom plans with dedicated support, SSO, and advanced security features.',
              },
              {
                question: 'What integrations do you support?',
                answer: 'We support Zapier, Slack, webhooks, and custom API integrations. Let us know what tools you use and we can help.',
              },
              {
                question: 'Can I migrate from another platform?',
                answer: 'Absolutely. We help customers migrate their content from other platforms with minimal downtime.',
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="group border-2 border-zinc-200 rounded-xl p-6 bg-white hover:border-zinc-300 transition-all cursor-pointer"
              >
                <summary className="flex items-center justify-between font-bold text-zinc-900">
                  <span>{faq.question}</span>
                  <span className="text-zinc-900 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-zinc-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-zinc-900 mb-6">Ready to get started?</h2>
          <p className="text-xl text-zinc-600 mb-8">
            Join hundreds of teams using INKO. Start your 14-day free trial today.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-zinc-900/10 hover:shadow-xl hover:shadow-zinc-900/20 transition-all"
          >
            Start free trial
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
};
