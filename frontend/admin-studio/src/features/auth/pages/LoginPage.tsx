import React, { useState, useEffect } from 'react';
import { ArrowRight, LockKeyhole, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { authSession } from '../lib/session';
import { getCurrentUserRequest, loginRequest } from '../../../shared/api/auth';
import { isSuperAdmin } from '../lib/accessControl';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../types';

const SITE_URL = import.meta.env.VITE_SITE_URL || "http://localhost:5175";

const getPostLoginPath = (user: AuthUser) => {
  if (!user.email_verified) {
    return '/admin/verify-quarantine';
  }

  if (isSuperAdmin(user)) {
    return '/admin/superadmin';
  }

  const hasIncompleteWorkspace = user.blog_memberships?.some(
    (membership) =>
      membership.blog.is_active &&
      membership.role === 'owner' &&
      membership.blog.onboarding_status !== 'completed',
  );

  return hasIncompleteWorkspace ? '/admin/onboarding' : '/admin/dashboard';
};

export const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

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
      const { access_token } = loginResponse.data;

      authSession.setToken(access_token);

      const userResponse = await getCurrentUserRequest();
      const userData = userResponse.data;

      login(access_token, userData);
      navigate(getPostLoginPath(userData));
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
      authSession.clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/admin/forgot-password');
  };
  return (
    // 🧠 CLEAN STRUCTURAL ELEMENT: Fits directly into the <Outlet /> of AuthLayout[cite: 4]
    <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl shadow-zinc-200/80 border border-zinc-100 p-8 md:p-10 transition-all">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-2">
          Welcome back
        </h1>
        <p className="text-zinc-500 text-sm">
          Sign in to your publishing dashboard
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-700">
            Email Address
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="email"
              placeholder="john@example.com"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-5 py-3 pl-12 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-700">
            Password
          </label>
          <div className="relative">
            <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-5 py-3 pl-12 pr-12 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors focus:outline-none cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Forgot Password Link */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs font-semibold text-zinc-500 hover:text-violet-600 transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Form Action Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-semibold py-3 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-purple-900/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

      {/* Optional New Account Gateway Selector Link */}
      <p className="text-center text-sm text-zinc-500 mt-8">
        Don't have an account?{" "}
        <Link
          to={SITE_URL + "/signup"} 
          className="text-violet-600 font-bold hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
};