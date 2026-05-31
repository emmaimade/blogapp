import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InkoLogo } from '../../../assets/inko';
import { authSession } from '../lib/session';
import { getCurrentUserRequest, loginRequest } from '../../../shared/api/auth';
import { isSuperAdmin } from '../lib/accessControl';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../types';

const getPostLoginPath = (user: AuthUser) => {
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
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
        setError('Invalid username or password');
      } else if (err.response?.status === 422) {
        setError('Please enter both username and password');
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
    // TODO: Implement forgot password flow
    alert("Forgot password flow coming soon!"); // Replace with real navigation/modal
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#f3e8ff_0%,transparent_70%)]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600">
              <InkoLogo color="white" size={28} />
            </div>
            <div>
              <div className="text-3xl font-black tracking-tighter text-zinc-900">INKO</div>
              <div className="text-xs font-semibold text-zinc-500 -mt-1">ADMIN STUDIO</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/80 border border-zinc-100 p-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-2">
              Welcome back
            </h1>
            <p className="text-zinc-600">
              Sign in to your publishing dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-4 top-4 text-zinc-400" size={20} />
                <input
                  type="text"
                  placeholder="johndoe or john@example.com"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 pl-12 text-base focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-4 text-zinc-400" size={20} />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 pl-12 text-base focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-zinc-600 hover:text-violet-600 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.985] text-white font-semibold py-4 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-violet-500/30 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={22} />
                </>
              )}
            </button>
          </form>

          {/* Google Sign In (Future-ready) */}
          <div className="mt-6">
            <button
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-3 border border-zinc-200 bg-white hover:bg-zinc-50 py-4 rounded-2xl text-sm font-medium text-zinc-700 transition-all disabled:opacity-60"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Sign in with Google
            </button>
            <p className="text-center text-[10px] text-zinc-400 mt-2">
              Google sign-in coming soon
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500 mt-8">
          © {new Date().getFullYear()} INKO • Secure Admin Access
        </p>
      </div>
    </div>
  );
};
