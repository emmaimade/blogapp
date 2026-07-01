import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { InkoLogo } from '../inko';

const ADMIN_STUDIO_URL = import.meta.env.VITE_ADMIN_STUDIO_URL || 'http://localhost:5173';

export const PublicLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle scroll for sticky header effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Active link helper
  const isActive = (path: string): boolean => {
    if (path === '/home' || path === '/') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Reusable nav link classes
  const getNavLinkClass = (path: string) => {
    const active = isActive(path);
    return `font-medium transition-all relative py-1 group
      ${active 
        ? 'text-zinc-900 after:absolute after:bottom-[-2px] after:left-0 after:h-[3px] after:w-full after:bg-primary after:rounded-full' 
        : 'text-zinc-600 hover:text-zinc-900 hover:after:absolute hover:after:bottom-[-2px] hover:after:left-0 hover:after:h-[2px] hover:after:w-0 hover:after:bg-zinc-400 hover:after:transition-all hover:after:duration-300 hover:after:w-full'
      }`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-zinc-200 shadow-sm"
            : "bg-white/80 backdrop-blur-lg border-b border-zinc-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-0.5 font-black text-xl hover:text-primary transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg">
                <InkoLogo color="purple" size={24} />
              </div>
              <span className="py-1 rounded-md">Inko</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/home" className={getNavLinkClass('/home')}>
                Home
              </Link>
              <Link to="/features" className={getNavLinkClass('/features')}>
                Features
              </Link>
              <Link to="/pricing" className={getNavLinkClass('/pricing')}>
                Pricing
              </Link>
              <Link to="/contact" className={getNavLinkClass('/contact')}>
                Contact
              </Link>
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <a
                href={ADMIN_STUDIO_URL}
                className="text-zinc-900 font-semibold hover:text-primary transition-colors"
              >
                Sign in
              </a>
              <Link
                to="/signup"
                className="px-6 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/10 transition-all"
              >
                Start free
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ${
              mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <nav className="flex flex-col gap-4 py-4 border-t border-zinc-200">
              <Link
                to="/home"
                className={`text-left py-2 transition-colors ${isActive('/home') ? 'text-primary font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                Home
              </Link>
              <Link
                to="/features"
                className={`text-left py-2 transition-colors ${isActive('/features') ? 'text-primary font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                Features
              </Link>
              <Link
                to="/pricing"
                className={`text-left py-2 transition-colors ${isActive('/pricing') ? 'text-primary font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                Pricing
              </Link>
              <Link
                to="/contact"
                className={`text-left py-2 transition-colors ${isActive('/contact') ? 'text-primary font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                Contact
              </Link>

              <div className="flex flex-col gap-3 pt-4 border-t border-zinc-200">
                <a
                  href={ADMIN_STUDIO_URL}
                  className="text-zinc-900 font-semibold text-center py-2.5 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Sign in
                </a>
                <Link
                  to="/signup"
                  className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg text-center hover:bg-primary-hover hover:shadow-lg transition-all"
                >
                  Start free
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer remains unchanged */}
      <footer className="relative bg-zinc-900 text-zinc-300 py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* ... (your existing footer code - unchanged) ... */}
        {/* Purple atmospheric tint */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_left,_rgba(124,58,237,0.12),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_right,_rgba(109,40,217,0.08),_transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div>
              <div className="flex items-center gap-2 font-black text-lg text-white mb-4">
                <div className="flex h-8 w-8 items-center justify-center bg-primary rounded-lg">
                  <InkoLogo color="white" size={20} />
                </div>
                <span>INKO</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Multi-tenant blog platform for teams and agencies. Publish,
                collaborate, and grow.
              </p>
            </div>

            {/* Product, Company, Legal columns... (unchanged) */}
            {/* ... keeping your original footer content ... */}
            <div>
              <h4 className="font-bold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Get Started</Link></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
                <li>
                  <a href="https://status.inko.blog" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors inline-flex items-center gap-1">
                    Status
                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-zinc-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-zinc-400">
            <p>&copy; {new Date().getFullYear()} INKO. All rights reserved.</p>

            <div className="flex gap-6">
              <a href="https://twitter.com/inkoblog" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="https://github.com/inkoblog" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label="GitHub">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
              </a>
              <a href="https://discord.gg/inkoblog" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label="Discord">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
