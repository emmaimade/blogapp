import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LogOut, Menu, Moon, Sun, User, X } from 'lucide-react';
import { useSiteName, useSiteSettings } from '../hooks/useSiteSettings';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { QuickSearch } from './QuickSearch';

// The logo is the way home, so the links only cover the other sections.
const navLinks = [
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>;

const getDisplayName = (user: AuthUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || 'Your account';

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: siteSettings } = useSiteSettings();
  const branding = siteSettings?.branding;
  const siteName = useSiteName();
  const logoUrl = branding?.logo_url;

  const currentUrl = location.pathname + location.search;

  // Each menu remembers the page it was opened on, so any navigation — a
  // link, the back button — closes it without a route-change effect.
  const [mobileMenuOpenedAt, setMobileMenuOpenedAt] = useState<string | null>(null);
  const [accountMenuOpenedAt, setAccountMenuOpenedAt] = useState<string | null>(null);
  const isMobileMenuOpen = mobileMenuOpenedAt === currentUrl;
  const isAccountMenuOpen = accountMenuOpenedAt === currentUrl;

  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => {
    setMobileMenuOpenedAt(null);
    setAccountMenuOpenedAt(null);
  }, []);

  // Mobile menu: focus moves into it on open; Escape (returning focus to the
  // menu button) or a tap outside the navbar closes it.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    mobileMenuRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMobileMenuOpenedAt(null);
      menuButtonRef.current?.focus();
    };
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMobileMenuOpenedAt(null);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isMobileMenuOpen]);

  // Account menu: same open/close behaviour, anchored to the avatar.
  useEffect(() => {
    if (!isAccountMenuOpen) return;
    accountMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAccountMenuOpenedAt(null);
      accountButtonRef.current?.focus();
    };
    const handleClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountMenuOpenedAt(null);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isAccountMenuOpen]);

  const isNavItemActive = (to: string) => {
    if (to === '/blog') {
      return (
        location.pathname === '/blog' ||
        location.pathname.startsWith('/post/') ||
        location.pathname === '/search'
      );
    }

    return location.pathname === to;
  };

  const getDesktopNavClassName = (to: string) =>
    [
      'rounded-lg px-3 py-2 text-sm font-medium transition',
      isNavItemActive(to)
        ? 'text-primary bg-zinc-100 dark:bg-zinc-800'
        : 'text-zinc-600 hover:text-primary hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
    ].join(' ');

  const getMobileNavClassName = (to: string) =>
    [
      'rounded-xl px-4 py-3 text-sm font-medium transition',
      isNavItemActive(to)
        ? 'text-primary bg-zinc-100 dark:bg-zinc-800'
        : 'text-zinc-700 hover:bg-zinc-50 hover:text-primary dark:text-zinc-300 dark:hover:bg-zinc-800/60',
    ].join(' ');

  // Signing out keeps the reader on the page they were reading. The one
  // exception is staff viewing an unpublished post: it's no longer visible to
  // them, so they go to the blog rather than a "not found" page.
  const handleLogout = () => {
    const slug = location.pathname.startsWith('/post/') ? safeDecode(location.pathname.slice('/post/'.length)) : null;
    const viewedPost = slug ? queryClient.getQueryData<{ status?: string }>(['post', slug]) : undefined;
    const wasViewingUnpublished = Boolean(viewedPost?.status && viewedPost.status !== 'published');

    logout();
    closeMenus();
    toast.success('Signed out');
    if (wasViewingUnpublished) navigate('/blog');
  };

  // Signing in returns the reader to this page (Auth reads `from`).
  const signInState = location.pathname === '/auth' ? undefined : { from: currentUrl };

  const displayName = user ? getDisplayName(user) : '';
  const initial = displayName.charAt(0).toUpperCase() || '?';

  return (
    <nav ref={navRef} className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 dark:bg-zinc-900/80 dark:border-zinc-800">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            to="/"
            aria-label={`Home – ${siteName}`}
            className="flex items-center gap-2 min-w-0"
            onClick={closeMenus}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={siteName}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span
                className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {siteName}
                <span className="text-primary">.</span>
              </span>
            )}
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={getDesktopNavClassName(link.to)}
                aria-current={isNavItemActive(link.to) ? 'page' : undefined}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <QuickSearch onOpen={closeMenus} />

          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg text-zinc-500 hover:text-primary hover:bg-zinc-100 transition dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="h-6 w-px bg-zinc-200 hidden sm:block dark:bg-zinc-800" aria-hidden="true"></div>

          {isAuthenticated && user ? (
            <div ref={accountRef} className="relative hidden sm:block">
              <button
                ref={accountButtonRef}
                onClick={() => setAccountMenuOpenedAt(isAccountMenuOpen ? null : currentUrl)}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                aria-controls="account-menu"
                aria-label={`Account: ${displayName}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white hover:bg-primary-hover transition-colors"
              >
                {initial}
              </button>

              {isAccountMenuOpen && (
                <div
                  ref={accountMenuRef}
                  id="account-menu"
                  role="menu"
                  aria-label="Account"
                  className="card absolute right-0 top-full z-50 mt-2 w-64 py-2 shadow-lg"
                >
                  <div className="px-4 pb-2 mb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</p>
                    {user.email && user.email !== displayName && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                    )}
                  </div>
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 outline-none transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                  >
                    <LogOut size={16} aria-hidden="true" /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              state={signInState}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-primary hover:bg-zinc-100 transition dark:text-zinc-400 dark:hover:bg-zinc-800"
              onClick={closeMenus}
            >
              <User size={16} aria-hidden="true" /> Sign in
            </Link>
          )}

          <button
            ref={menuButtonRef}
            className="md:hidden p-2 rounded-lg text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setAccountMenuOpenedAt(null);
              setMobileMenuOpenedAt(isMobileMenuOpen ? null : currentUrl);
            }}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          className="md:hidden border-t border-zinc-100 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={getMobileNavClassName(link.to)}
                  aria-current={isNavItemActive(link.to) ? 'page' : undefined}
                  onClick={closeMenus}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {isAuthenticated && user ? (
                <>
                  <p className="mb-3 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    Signed in as <span className="font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</span>
                  </p>
                  <button onClick={handleLogout} className="btn-secondary w-full">
                    <LogOut size={16} aria-hidden="true" /> Log out
                  </button>
                </>
              ) : (
                <Link to="/auth" state={signInState} className="btn-secondary w-full" onClick={closeMenus}>
                  <User size={16} aria-hidden="true" /> Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
