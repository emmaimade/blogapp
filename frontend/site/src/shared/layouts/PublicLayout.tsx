import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { InkoLogo } from '../inko';
import { ADMIN_STUDIO_URL } from '../config';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const footerColumns = [
  {
    heading: 'Product',
    links: [
      { to: '/features', label: 'Features' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/signup', label: 'Get started' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
      { to: '/acceptable-use', label: 'Acceptable Use' },
    ],
  },
];

export const PublicLayout = () => {
  const location = useLocation();
  // The menu remembers which page it was opened on, so navigating anywhere closes it.
  const [menuOpenedOn, setMenuOpenedOn] = useState<string | null>(null);
  const mobileMenuOpen = menuOpenedOn === location.pathname;
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll for sticky header effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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
            <nav aria-label="Main" className="hidden md:flex items-center gap-8">
              {navLinks.map(({ to, label }) => (
                <Link key={to} to={to} className={getNavLinkClass(to)} aria-current={isActive(to) ? 'page' : undefined}>
                  {label}
                </Link>
              ))}
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
              type="button"
              onClick={() => setMenuOpenedOn(mobileMenuOpen ? null : location.pathname)}
              className="md:hidden p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu — inert while collapsed so its links can't be tabbed into */}
          <div
            id="mobile-menu"
            inert={!mobileMenuOpen}
            className={`md:hidden overflow-hidden transition-all duration-300 ${
              mobileMenuOpen ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <nav aria-label="Mobile" className="flex flex-col gap-4 py-4 border-t border-zinc-200">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  aria-current={isActive(to) ? 'page' : undefined}
                  className={`text-left py-2 transition-colors ${isActive(to) ? 'text-primary font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}
                >
                  {label}
                </Link>
              ))}

              <div className="flex flex-col gap-3 pt-4 border-t border-zinc-200">
                <a
                  href={ADMIN_STUDIO_URL}
                  className="text-zinc-900 font-semibold text-center py-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
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

      <footer className="relative bg-zinc-900 text-zinc-300 py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Purple atmospheric tint */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_left,_rgba(124,58,237,0.12),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_right,_rgba(109,40,217,0.08),_transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div>
              <div className="flex items-center gap-2 font-black text-lg text-white mb-4">
                <div className="flex h-8 w-8 items-center justify-center">
                  <InkoLogo color="purple" size={20} />
                </div>
                <span>Inko</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Multi-tenant blog platform for teams and agencies. Publish,
                collaborate, and grow.
              </p>
            </div>

            {footerColumns.map(({ heading, links }) => (
              <div key={heading}>
                <h2 className="font-bold text-white mb-4">{heading}</h2>
                <ul className="space-y-3 text-sm">
                  {links.map(({ to, label }) => (
                    <li key={to}>
                      <Link to={to} className="hover:text-white transition-colors">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-zinc-800 pt-5 text-sm text-zinc-400">
            <p>&copy; {new Date().getFullYear()} Inko. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
