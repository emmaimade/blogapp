import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import api from "../api/blogApi";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

const loginWithFallback = async (payload: URLSearchParams) => {
  try {
    return await api.post("/auth/login", payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (error: any) {
    if (error.response?.status !== 404) {
      throw error;
    }

    return api.post("/users/login", payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }
};

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"email" | "username" | "password">("email");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Reset to email step when switching modes
  const switchMode = (newMode: "login" | "signup") => {
    setMode(newMode);
    setStep("email");
    setFormData({ email: "", password: "", username: "" });
  };

  // Handle email step
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    // Login: email → password
    // Signup: email → username
    setStep(mode === "login" ? "password" : "username");
  };

  // Handle username step (signup only)
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      toast.error("Please enter a username");
      return;
    }
    setStep("password");
  };

  // Handle final submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signup") {
        await api.post("/users/register", formData);
        toast.success("Account created! Please login.");
        switchMode("login");
      } else {
        const loginData = new URLSearchParams();
        loginData.append("username", formData.email);
        loginData.append("password", formData.password);

        const res = await loginWithFallback(loginData);

        login(
          res.data.access_token,
          {
            id: res.data.user?.id,
            username: res.data.user?.username,
          },
          res.data.refresh_token,
        );

        toast.success("Welcome back!");

        const from = (location.state as any)?.from;
        const draft = (location.state as any)?.draft;
        const safeReturn =
          typeof from === "string" && from.startsWith("/") ? from : "/";
        if (draft) {
          navigate(safeReturn, { state: { draft } });
        } else {
          navigate(safeReturn);
        }
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let errorMsg = "Authentication failed";
      if (detail) {
        if (Array.isArray(detail)) {
          errorMsg = detail
            .map((d: any) => d.msg || JSON.stringify(d))
            .join("; ");
        } else if (typeof detail === "object") {
          errorMsg = detail.message || JSON.stringify(detail);
        } else {
          errorMsg = String(detail);
        }
      }
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Go back one step
  const goBack = () => {
    if (step === "password") {
      setStep(mode === "login" ? "email" : "username");
      setFormData({ ...formData, password: "" });
    } else if (step === "username") {
      setStep("email");
      setFormData({ ...formData, username: "" });
    }
  };

  // Get contextual message
  const getMessage = () => {
    if (step === "email") {
      return mode === "login"
        ? "Enter your email to continue"
        : "Create your account to get started";
    } else if (step === "username") {
      return "Choose a username";
    } else {
      return mode === "login"
        ? `Welcome back, ${formData.email}`
        : "Create a secure password";
    }
  };

  // Calculate progress
  const getTotalSteps = () => (mode === "login" ? 2 : 3);
  const getCurrentStepNumber = () => {
    if (step === "email") return 1;
    if (step === "username") return 2;
    if (step === "password") return mode === "login" ? 2 : 3;
    return 1;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-50 py-12 px-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-zinc-900">
            {mode === "login" ? "Welcome Back!" : "Join the Community"}
          </h2>
          <p className="text-zinc-600 mt-2">{getMessage()}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-zinc-100 p-8">
          {/* Tabs - Only show on email step */}
          {step === "email" && (
            <div className="flex gap-2 mb-8 bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                  mode === "login"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => switchMode("signup")}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                  mode === "signup"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Progress Indicator */}
          {step !== "email" && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <div className="flex-1"></div>
                <div className="flex gap-1.5">
                  {Array.from({ length: getTotalSteps() }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-8 h-1 rounded-full transition-colors ${
                        i < getCurrentStepNumber()
                          ? "bg-zinc-900"
                          : "bg-zinc-200"
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Email */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  {mode === "signup" ? "Email Address" : "Email or Username"}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Mail size={20} />
                  </div>
                  <input
                    autoFocus
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base"
                    placeholder={
                      mode === "signup"
                        ? "you@example.com"
                        : "you@example.com or johndoe"
                    }
                    type={mode === "signup" ? "email" : "text"}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10 hover:shadow-xl flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight size={20} />
              </button>
            </form>
          )}

          {/* STEP 2: Username (Signup only) */}
          {step === "username" && mode === "signup" && (
            <form onSubmit={handleUsernameSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <UserIcon size={20} />
                  </div>
                  <input
                    autoFocus
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  This is how others will see you on the platform
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10 hover:shadow-xl flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight size={20} />
              </button>
            </form>
          )}

          {/* STEP 3: Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Lock size={20} />
                  </div>
                  <input
                    autoFocus
                    className="w-full pl-12 pr-12 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {mode === "signup" && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Must be at least 8 characters
                  </p>
                )}
              </div>

              {mode === "login" && (
                <div className="text-right">
                  <a
                    href="#"
                    className="text-sm text-zinc-900 hover:text-zinc-950 font-medium"
                  >
                    Forgot password?
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : mode === "login" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          {/* Footer - Only show on email step */}
          {step === "email" && (
            <p className="mt-6 text-center text-sm text-zinc-600">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() =>
                  switchMode(mode === "login" ? "signup" : "login")
                }
                className="text-zinc-900 hover:text-zinc-950 font-bold"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>

        {/* Terms */}
        <p className="mt-8 text-center text-xs text-zinc-500">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-zinc-900 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-zinc-900 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};
