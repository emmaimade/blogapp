import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Reset token is missing from the URL link configuration.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        token: token,
        new_password: password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update your password. The link may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl border border-zinc-100 p-8 md:p-10 text-center">
        <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 w-fit mx-auto mb-4">
          <CheckCircle2 size={36} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 mb-2">Password Updated</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Your new credentials are now active. You can safely return to the login interface.
        </p>
        <button
          onClick={() => navigate("/admin/login")}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
        >
          Sign In Now <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl border border-zinc-100 p-8 md:p-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 mb-2">Set new password</h1>
        <p className="text-sm text-zinc-500">Create a secure password configuration layers for your account.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-700">New Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-5 py-3 pl-12 pr-12 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-700">Confirm New Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-5 py-3 pl-12 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !password || !confirmPassword}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Update Password"}
        </button>
      </form>
    </div>
  );
};