import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, User, X } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const token = localStorage.getItem('token');
  const { data: siteSettings } = useSiteSettings();
  const general = siteSettings?.general;
  const branding = siteSettings?.branding;
  const siteName = general?.site_name || 'Inko';
  const primaryColor = branding?.primary_color || '#9333EA';
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
        ? 'text-zinc-900 bg-zinc-100'
        : 'text-zinc-600 hover:text-primary hover:bg-zinc-50',
    ].join(' ');

  const getMobileNavClassName = (to: string) =>
    [
      'rounded-2xl px-4 py-3 text-sm font-bold transition',
      isNavItemActive(to)
        ? 'text-zinc-900 bg-zinc-100'
        : 'text-zinc-700 hover:bg-zinc-50 hover:text-primary',
    ].join(' ');

  const handleLogout = () => {
    localStorage.removeItem('token');
    closeMenu();
    navigate('/auth');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 min-w-0 group"
          onClick={closeMenu}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span
              className="text-xl sm:text-2xl font-black tracking-tighter text-zinc-900 transition-colors truncate"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {siteName}
              <span style={{ color: primaryColor }}>.</span>
            </span>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={getDesktopNavClassName(link.to)}
              style={
                isNavItemActive(link.to) ? { color: primaryColor } : undefined
              }
              aria-current={isNavItemActive(link.to) ? "page" : undefined}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            to="/search"
            className="text-zinc-400 hover:text-primary transition"
            aria-label="Search"
            onClick={closeMenu}
          >
            <Search size={20} />
          </Link>

          <div className="h-6 w-[1px] bg-zinc-100 hidden sm:block"></div>

          {token ? (
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-zinc-900 transition"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              className="hidden sm:flex items-center gap-2 text-white px-5 py-2.5 rounded-full text-sm font-bold transition shadow-lg"
              style={{
                background: primaryColor,
                boxShadow: `0 10px 25px -15px ${primaryColor}`,
              }}
              onClick={closeMenu}
            >
              <User size={16} /> Sign In
            </Link>
          )}

          <button
            className="md:hidden text-zinc-900"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-100 bg-white/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={getMobileNavClassName(link.to)}
                aria-current={isNavItemActive(link.to) ? "page" : undefined}
                onClick={closeMenu}
              >
                {link.label}
              </NavLink>
            ))}

            {token ? (
              <button
                onClick={handleLogout}
                className="mt-2 inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-zinc-900 transition"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/auth"
                className="mt-2 inline-flex items-center justify-center gap-2 text-white px-5 py-3 rounded-2xl text-sm font-bold transition shadow-lg"
                style={{
                  background: `${primaryColor}`,
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
