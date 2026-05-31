// src/components/NewsletterPopup.tsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export const NewsletterPopup: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Check if popup was already shown in this session
  useEffect(() => {
    const hasSeen = sessionStorage.getItem('newsletter_seen');
    if (hasSeen) return;

    const handleScroll = () => {
      // Show after scrolling ~35% of document height
      const scrollPosition = window.scrollY + window.innerHeight;
      const triggerPoint = document.documentElement.scrollHeight * 0.35;

      if (scrollPosition >= triggerPoint) {
        setIsVisible(true);
        // Mark as seen so it doesn't show again in this session
        sessionStorage.setItem('newsletter_seen', 'true');
        // Optional: remove listener after first show
        window.removeEventListener('scroll', handleScroll);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');

    try {
      // Replace with your actual newsletter subscription endpoint
      // Example: Mailchimp, ConvertKit, Buttondown, Beehiiv, your own FastAPI endpoint...
      const response = await fetch('https://your-api.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error('Subscription failed');

      setStatus('success');
      setEmail('');
      // Optional: close popup after success
      setTimeout(() => setIsVisible(false), 2000);
    } catch (err) {
      setStatus('error');
      console.error(err);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative animate-scaleIn">
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800 transition-colors"
          aria-label="Close popup"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <div className="p-8 pb-2">
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">
            Join the Inko Community
          </h2>
          <p className="text-zinc-600 mb-6">
            Get new articles, tips and curated frontend/backend content delivered straight to your inbox.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-primary focus:ring-2 focus:ring-primary outline-none transition-all"
            />

            <button
              type="submit"
              disabled={status === 'loading'}
              className={`
 w-full py-3 px-6 rounded-xl font-medium text-white transition-all
 ${status === 'loading' 
 ? 'bg-primary cursor-not-allowed' 
 : 'bg-primary hover:bg-purple-700 active:bg-purple-800'}
 `}
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>

            {status === 'success' && (
              <p className="text-center text-green-600 text-sm font-medium">
                Thank you! Check your inbox (and spam folder).
              </p>
            )}

            {status === 'error' && (
              <p className="text-center text-red-600 text-sm">
                Something went wrong. Please try again.
              </p>
            )}
          </form>

          <p className="text-xs text-zinc-500 text-center mt-6">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </div>
  );
};
