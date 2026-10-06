import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Home } from './pages/Home';
import { PostDetail } from './pages/PostDetail';
import BlogList from './pages/BlogList';
import { AuthPage } from './pages/Auth';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { SearchResults } from './pages/SearchResults';
import { NotFound } from './pages/NotFound';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { useSiteName, useSiteSettings } from './hooks/useSiteSettings';
import { upsertHeadElement } from './utils/seo';
import { letterFavicon } from './utils/favicon';
import { tagUrl } from './utils/posts';

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

// Tags are browsed on the blog list (`/blog?tag=`); old `/tag/:tag` links
// still work. On Vercel the middleware answers these with a real 301 first.
const TagRedirect = () => {
  const { tag = '' } = useParams();
  return <Navigate to={tag ? tagUrl(tag) : '/blog'} replace />;
};

function App() {
  const { data: siteSettings } = useSiteSettings();
  const siteName = useSiteName();

  useEffect(() => {
    const general = siteSettings?.general;
    const branding = siteSettings?.branding;
    const seo = siteSettings?.seo;

    const primaryColor = branding?.primary_color || '#9333EA';
    const secondaryColor = branding?.secondary_color || '#18181B';
    const accentColor = branding?.accent_color || '#A855F7';
    const faviconUrl = branding?.favicon_url || letterFavicon(siteName, primaryColor);
    const twitterHandle = seo?.twitter_handle
      ? seo.twitter_handle.startsWith('@') ? seo.twitter_handle : `@${seo.twitter_handle}`
      : '';

    document.documentElement.lang = general?.language || 'en';
    document.documentElement.style.setProperty('--brand-primary', primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', secondaryColor);
    document.documentElement.style.setProperty('--brand-accent', accentColor);
    document.documentElement.style.setProperty('--font-heading', `${branding?.font_heading || 'Inter'}, sans-serif`);
    document.documentElement.style.setProperty('--font-body', `${branding?.font_body || 'Inter'}, sans-serif`);

    applyFontLink(branding?.font_heading || 'Inter', branding?.font_body || 'Inter');
    applyTypographyRules();

    // Title/description/OG/Twitter content tags are page-owned (via usePageMeta /
    // applyPageMeta) — don't set them here. This effect fires after each page's
    // own mount effect (React runs child effects before parent effects), so
    // anything set here would clobber the page-specific values on first load.
    upsertHeadElement('meta[name="keywords"]', 'meta', { name: 'keywords', content: seo?.meta_keywords || '' });
    upsertHeadElement('meta[name="author"]', 'meta', { name: 'author', content: siteName });
    upsertHeadElement('meta[name="language"]', 'meta', { name: 'language', content: general?.language || 'English' });
    upsertHeadElement('meta[name="theme-color"]', 'meta', { name: 'theme-color', content: primaryColor });
    upsertHeadElement('meta[name="msapplication-TileColor"]', 'meta', { name: 'msapplication-TileColor', content: primaryColor });
    upsertHeadElement('meta[name="google-site-verification"]', 'meta', {
      name: 'google-site-verification',
      content: seo?.google_site_verification || '',
    });
    upsertHeadElement('meta[property="og:site_name"]', 'meta', { property: 'og:site_name', content: siteName });
    // A tenant without a handle gets no creator tag rather than the platform's.
    if (twitterHandle) {
      upsertHeadElement('meta[name="twitter:creator"]', 'meta', { name: 'twitter:creator', content: twitterHandle });
    } else {
      document.head.querySelector('meta[name="twitter:creator"]')?.remove();
    }
    upsertHeadElement('link[rel="icon"]', 'link', { rel: 'icon', href: faviconUrl });
    // iOS ignores SVG/data-URI touch icons, so only a real uploaded favicon is used there.
    if (branding?.favicon_url) {
      upsertHeadElement('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', href: branding.favicon_url });
    } else {
      document.head.querySelector('link[rel="apple-touch-icon"]')?.remove();
    }
  }, [siteSettings, siteName]);

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:bg-zinc-800 dark:text-zinc-50',
        }}
      />
      <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans flex flex-col">
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
            <Route path="/tag/:tag" element={<TagRedirect />} />
            <Route path="/search" element={<SearchResults />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
