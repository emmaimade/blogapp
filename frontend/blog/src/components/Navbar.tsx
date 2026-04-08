import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, User, X } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';

// Inko Logo Component
const InkoLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="inline-block"
  >
    <defs>
      <linearGradient id="inkoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5" />
        <stop offset="50%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z"
      fill="url(#inkoGradient)"
    />
    <circle cx="12" cy="19" r="2" fill="url(#inkoGradient)" opacity="0.6" />
  </svg>
);

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const token = localStorage.getItem('token');
  const { data: siteSettings } = useSiteSettings();
  const general = siteSettings?.general;
  const branding = siteSettings?.branding;
  const siteName = general?.site_name || 'Inko';
  const primaryColor = branding?.primary_color || '#4F46E5';
  const secondaryColor = branding?.secondary_color || '#7C3AED';
  const logoUrl = branding?.logo_url;

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/blog', label: 'Blog' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  const closeMenu = () => setIsMobileMenuOpen(false);

  const isNavItemActive = (to: string) => {
    if (to === '/') {
      return location.pathname === '/';
    }

    if (to === '/blog') {
      return (
        location.pathname === '/blog' ||
        location.pathname.startsWith('/post/') ||
        location.pathname.startsWith('/tag/') ||
        location.pathname === '/search'
      );
    }

    return location.pathname === to;
  };

  const getDesktopNavClassName = (to: string) =>
    [
      'relative rounded-full px-3 py-2 text-sm font-bold transition',
      isNavItemActive(to)
        ? 'text-slate-900 bg-slate-100'
        : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50',
    ].join(' ');

  const getMobileNavClassName = (to: string) =>
    [
      'rounded-2xl px-4 py-3 text-sm font-bold transition',
      isNavItemActive(to)
        ? 'bg-slate-900 text-white'
        : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600',
    ].join(' ');

  const handleLogout = () => {
    localStorage.removeItem('token');
    closeMenu();
    navigate('/auth');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 min-w-0 group" onClick={closeMenu}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <InkoLogo size={28} />
          )}
          <span
            className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 transition-colors truncate"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {siteName}<span style={{ color: primaryColor }}>.</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={getDesktopNavClassName(link.to)}
              style={isNavItemActive(link.to) ? { color: primaryColor } : undefined}
              aria-current={isNavItemActive(link.to) ? 'page' : undefined}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            to="/search"
            className="text-slate-400 hover:text-indigo-600 transition"
            aria-label="Search"
            onClick={closeMenu}
          >
            <Search size={20} />
          </Link>

          <div className="h-6 w-[1px] bg-slate-100 hidden sm:block"></div>

          {token ? (
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-600 transition"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              className="hidden sm:flex items-center gap-2 text-white px-5 py-2.5 rounded-full text-sm font-bold transition shadow-lg"
              style={{
                background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                boxShadow: `0 10px 25px -15px ${primaryColor}`,
              }}
              onClick={closeMenu}
            >
              <User size={16} /> Sign In
            </Link>
          )}

          <button
            className="md:hidden text-slate-900"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={getMobileNavClassName(link.to)}
                aria-current={isNavItemActive(link.to) ? 'page' : undefined}
                onClick={closeMenu}
              >
                {link.label}
              </NavLink>
            ))}

            {token ? (
              <button
                onClick={handleLogout}
                className="mt-2 inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-600 transition"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/auth"
                className="mt-2 inline-flex items-center justify-center gap-2 text-white px-5 py-3 rounded-2xl text-sm font-bold transition shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: `0 10px 25px -15px ${primaryColor}`,
                }}
                onClick={closeMenu}
              >
                <User size={16} /> Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export { InkoLogo };
