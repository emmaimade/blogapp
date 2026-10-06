import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { loginRequest } from '../../../shared/api/auth';
import { getPostLoginPath } from '../lib/accessControl';
import { useAuth } from '../context/AuthContext';
import { InkoLogo } from '../../../assets/inko';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const SITE_URL = import.meta.env.VITE_SITE_URL || "http://localhost:5175";

export const LoginView = () => {
  useDocumentTitle('Sign in');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Only honor same-origin relative redirects (e.g. "/join/abc123") — never
  // an absolute URL, which could be used to redirect a freshly-authenticated
  // session off to an attacker-controlled site.
  const redirectTo = searchParams.get('redirect');
  const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : null;

  // Force light mode on login page
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    
    html.classList.remove('dark');
    
    return () => {
      if (wasDark) {
        html.classList.add('dark');
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const loginResponse = await loginRequest(formData);
      const userData = loginResponse.data.user;

      login(userData);
      navigate(safeRedirect || getPostLoginPath(userData));
    } catch (err: any) {
      console.error('Login error:', err);

      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.status === 422) {
        setError('Please enter both email and password');
      } else if (!err.response) {
        setError('Cannot connect to server. Please check if backend is running.');
      } else {
        setError(err.response?.data?.detail || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/admin/forgot-password');
  };
  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden flex bg-zinc-50 text-zinc-900 font-sans">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-violet-900 px-12 py-10 text-white">
        {/* Dot texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* Oversized faded mark */}
        <InkoLogo
          color="white"
          size={420}
          className="pointer-events-none absolute -right-24 -bottom-20 opacity-[0.07]"
        />

        <Link to={SITE_URL + "/"} className="relative flex items-center gap-1.5 font-black text-xl w-fit">
          <InkoLogo color="white" size={28} />
          <span>Inko</span>
        </Link>

        <div className="relative max-w-md">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-200 mb-4">
            Inko Studio
          </p>
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Write. Publish. Grow your audience.
          </h2>
          <p className="mt-5 text-lg text-violet-100/90">
            Manage your posts, comments and readers in one place.
          </p>
        </div>

        <p className="relative text-xs text-white/60">© 2026 Inko. All rights reserved.</p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 lg:w-1/2 flex flex-col lg:min-h-0">
        <div className="flex-1 lg:min-h-0 flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-sm">
            <Link
              to={SITE_URL + "/"}
              className="lg:hidden flex items-center justify-center gap-1 mb-6 font-black text-xl"
            >
              <InkoLogo color="purple" size={28} />
              <span>Inko</span>
            </Link>

            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-1">
                Welcome back
              </h1>
              <p className="text-sm text-zinc-500">
                Sign in to your publishing dashboard
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg shadow-zinc-200/60 border border-zinc-100 p-6 sm:p-7">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2.5">
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="john@example.com"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-base sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 pr-12 text-base sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold py-2.5 rounded-full text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-violet-900/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-zinc-500 mt-6">
                Don't have an account?{" "}
                <Link
                  to={SITE_URL + "/signup"}
                  className="text-violet-600 font-bold hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Help & legal */}
        <footer className="shrink-0 px-4 pb-4 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-400">
          <a href="mailto:support@inko.blog" className="hover:text-violet-600 transition-colors">
            Need help?
          </a>
          <span className="text-zinc-200 select-none">•</span>
          <a href="#" className="hover:text-violet-600 transition-colors">Privacy</a>
          <span className="text-zinc-200 select-none">•</span>
          <a href="#" className="hover:text-violet-600 transition-colors">Terms</a>
          <span className="lg:hidden text-zinc-200 select-none">•</span>
          <span className="lg:hidden">© 2026 INKO</span>
        </footer>
      </main>
    </div>
  );
};
