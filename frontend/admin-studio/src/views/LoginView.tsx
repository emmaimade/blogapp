import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, User, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useId } from 'react';

export const LoginView = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const gradientId = useId();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const loginResponse = await api.post('/users/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const { access_token } = loginResponse.data;
      localStorage.setItem('token', access_token);
      
      const userResponse = await api.get('/users/me');
      const userData = userResponse.data;
      
      login(access_token, userData);
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else if (err.response?.status === 422) {
        setError('Please enter both username and password');
      } else if (!err.response) {
        setError('Cannot connect to server. Make sure backend is running on port 8000.');
      } else {
        setError(err.response?.data?.detail || 'Login failed. Please try again.');
      }
      
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // ✅ LoginView is exempted from dark mode (industry standard practice)
    // Public authentication pages maintain consistent brand presentation across all user devices
    // See: GitHub, Linear, Figma, Slack all use light-mode-only login pages
    <div className="light relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 px-4 py-10">
      {/* ✅ Animated gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.1),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.1),_transparent_50%)]" />
      </div>

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white/80 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl lg:grid-cols-[1.1fr_1fr]">
        
        {/* ✅ Left Panel - Brand Story */}
        <section className="hidden border-r border-slate-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-12 lg:flex lg:flex-col lg:justify-between">
          <div>
            {/* Inko Logo */}
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-3 shadow-lg shadow-indigo-500/30">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="100%" stopColor="#FFFFFF" opacity="0.8" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z" fill={`url(#${gradientId})`} />
                  <circle cx="12" cy="19" r="2" fill={`url(#${gradientId})`} opacity="0.7" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight text-slate-900">INKO</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin Studio</div>
              </div>
            </div>

            <h1 className="max-w-lg text-5xl font-black leading-[1.1] text-slate-900">
              Your creative control center
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
              Manage content, moderate discussions, and grow your blog from one elegant interface.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="mt-12 grid gap-4">
            <div className="rounded-2xl border border-indigo-100 bg-white/60 p-6 backdrop-blur-sm">
              <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-indigo-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <div className="h-2 w-2 rounded-full bg-indigo-600"></div>
                Secure Access
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Enterprise-grade authentication protects your content and user data.
              </p>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-white/60 p-6 backdrop-blur-sm">
              <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-700">
                <div className="h-2 w-2 rounded-full bg-purple-600"></div>
                Real-Time Analytics
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Track engagement, monitor growth, and make data-driven decisions.
              </p>
            </div>
          </div>
        </section>

        {/* ✅ Right Panel - Login Form */}
        <section className="flex items-center justify-center p-8 sm:p-12 lg:p-16">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2.5 shadow-lg">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z" fill="white" />
                  <circle cx="12" cy="19" r="2" fill="white" opacity="0.7" />
                </svg>
              </div>
              <div className="text-2xl font-black">INKO</div>
            </div>

            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-600"></div>
                Admin Access
              </div>
              <h2 className="text-4xl font-black text-slate-900">Welcome back</h2>
              <p className="mt-3 text-slate-600">
                Sign in to access your publishing dashboard
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* ✅ Error Message */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <span className="text-xs font-bold">!</span>
                    </div>
                    <div className="flex-1">{error}</div>
                  </div>
                </div>
              )}

              {/* ✅ Username Input */}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Username</span>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Enter your username"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 pl-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:bg-indigo-50/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </label>

              {/* ✅ Password Input */}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Password</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 pl-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:bg-indigo-50/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </label>

              {/* ✅ Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                <span className="relative flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Enter Admin Studio
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* ✅ Footer Note */}
            <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-xs text-slate-600">
                🔒 Your credentials are encrypted and secure
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};