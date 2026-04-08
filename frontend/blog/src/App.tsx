import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Home } from './pages/Home';
import { PostDetail } from './pages/PostDetail';
import BlogList from './pages/BlogList';
import { AuthPage } from './pages/Auth';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { TagPosts } from './pages/TagPosts';
import { SearchResults } from './pages/SearchResults';
import { NotFound } from './pages/NotFound';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { NewsletterPopup } from './components/NewsletterPopup';
import { useSiteSettings } from './hooks/useSiteSettings';

const upsertHeadElement = (
  selector: string,
  tagName: 'meta' | 'link',
  attributes: Record<string, string>
) => {
  let element = document.head.querySelector(selector) as HTMLElement | null;

  if (!element) {
    element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key !== 'content' && key !== 'href') {
        element!.setAttribute(key, value);
      }
    });
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });
};

const applyFontLink = (fontHeading: string, fontBody: string) => {
  const families = Array.from(new Set([fontHeading, fontBody].filter(Boolean)));
  const familyQuery = families
    .map((font) => `family=${font.trim().replace(/\s+/g, '+')}:wght@400;500;600;700;800;900`)
    .join('&');

  if (!familyQuery) return;

  let link = document.getElementById('dynamic-site-fonts') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'dynamic-site-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  link.href = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
};

const applyTypographyRules = () => {
  let style = document.getElementById('dynamic-site-typography') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'dynamic-site-typography';
    document.head.appendChild(style);
  }

  style.textContent = `
    body { font-family: var(--font-body); }
    h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
  `;
};

function App() {
  const { data: siteSettings } = useSiteSettings();

  useEffect(() => {
    const general = siteSettings?.general;
    const branding = siteSettings?.branding;
    const seo = siteSettings?.seo;

    const siteName = general?.site_name || 'Inko';
    const siteTagline = general?.site_tagline || 'Your ideas, amplified';
    const siteDescription =
      seo?.meta_description || general?.site_description || 'A modern blog CMS for sharing your stories and ideas';
    const metaTitle = seo?.meta_title || `${siteName} - ${siteTagline}`;
    const primaryColor = branding?.primary_color || '#4F46E5';
    const secondaryColor = branding?.secondary_color || '#7C3AED';
    const accentColor = branding?.accent_color || '#EC4899';
    const faviconUrl = branding?.favicon_url || '/inko-logo.svg';
    const ogImage = seo?.og_image || 'https://yourdomain.com/og-image.png';
    const twitterHandle = seo?.twitter_handle
      ? seo.twitter_handle.startsWith('@') ? seo.twitter_handle : `@${seo.twitter_handle}`
      : '@InkoCMS';

    document.title = metaTitle;
    document.documentElement.lang = general?.language || 'en';
    document.documentElement.style.setProperty('--brand-primary', primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', secondaryColor);
    document.documentElement.style.setProperty('--brand-accent', accentColor);
    document.documentElement.style.setProperty('--font-heading', `${branding?.font_heading || 'Inter'}, sans-serif`);
    document.documentElement.style.setProperty('--font-body', `${branding?.font_body || 'Inter'}, sans-serif`);

    applyFontLink(branding?.font_heading || 'Inter', branding?.font_body || 'Inter');
    applyTypographyRules();

    upsertHeadElement('meta[name="title"]', 'meta', { name: 'title', content: metaTitle });
    upsertHeadElement('meta[name="description"]', 'meta', { name: 'description', content: siteDescription });
    upsertHeadElement('meta[name="keywords"]', 'meta', { name: 'keywords', content: seo?.meta_keywords || '' });
    upsertHeadElement('meta[name="author"]', 'meta', { name: 'author', content: siteName });
    upsertHeadElement('meta[name="language"]', 'meta', { name: 'language', content: general?.language || 'English' });
    upsertHeadElement('meta[name="theme-color"]', 'meta', { name: 'theme-color', content: primaryColor });
    upsertHeadElement('meta[name="msapplication-TileColor"]', 'meta', { name: 'msapplication-TileColor', content: primaryColor });
    upsertHeadElement('meta[name="google-site-verification"]', 'meta', {
      name: 'google-site-verification',
      content: seo?.google_site_verification || '',
    });
    upsertHeadElement('meta[property="og:title"]', 'meta', { property: 'og:title', content: metaTitle });
    upsertHeadElement('meta[property="og:description"]', 'meta', { property: 'og:description', content: siteDescription });
    upsertHeadElement('meta[property="og:image"]', 'meta', { property: 'og:image', content: ogImage });
    upsertHeadElement('meta[property="og:site_name"]', 'meta', { property: 'og:site_name', content: siteName });
    upsertHeadElement('meta[name="twitter:title"]', 'meta', { name: 'twitter:title', content: metaTitle });
    upsertHeadElement('meta[name="twitter:description"]', 'meta', { name: 'twitter:description', content: siteDescription });
    upsertHeadElement('meta[name="twitter:image"]', 'meta', { name: 'twitter:image', content: ogImage });
    upsertHeadElement('meta[name="twitter:creator"]', 'meta', { name: 'twitter:creator', content: twitterHandle });
    upsertHeadElement('link[rel="icon"]', 'link', { rel: 'icon', href: faviconUrl });
    upsertHeadElement('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', href: faviconUrl });
  }, [siteSettings]);

  return (
    <Router>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            {/* Main Pages */}
            <Route path="/" element={<Home />} />
            <Route path="/post/:slug" element={<PostDetail />} />
            <Route path="/blog" element={<BlogList />} />
            
            {/* Auth - Single route with tabs */}
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Static Pages */}
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            
            {/* Dynamic Pages */}
            <Route path="/tag/:tag" element={<TagPosts />} />
            <Route path="/search" element={<SearchResults />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
        <NewsletterPopup />
      </div>
    </Router>
  );
}

export default App;
