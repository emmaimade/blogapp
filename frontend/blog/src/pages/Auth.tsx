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
  CheckCircle2,
} from "lucide-react";
import api from "../api/blogApi";
import { getApiErrorMessage, getErrorStatus } from "../api/errors";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

const loginWithFallback = async (payload: URLSearchParams) => {
  try {
    return await api.post("/auth/login", payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (error) {
    if (getErrorStatus(error) !== 404) {
      throw error;
    }

    return api.post("/users/login", payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }
};
import { usePageMeta } from "../hooks/usePageMeta";

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"email" | "username" | "password" | "forgot">("email");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  usePageMeta(step === "forgot" ? "Reset password" : mode === "login" ? "Sign in" : "Create account");

  // Reset to email step when switching modes
  const switchMode = (newMode: "login" | "signup") => {
    setMode(newMode);
    setStep("email");
    setFormData({ email: "", password: "", username: "" });
    setResetEmailSent(false);
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

        login({
          id: res.data.user?.id,
          username: res.data.user?.username,
          first_name: res.data.user?.first_name,
          last_name: res.data.user?.last_name,
          email: res.data.user?.email,
        });

        toast.success("Welcome back!");

        const returnState = location.state as { from?: unknown; draft?: unknown } | null;
        const from = returnState?.from;
        const draft = returnState?.draft;
        const safeReturn =
          typeof from === "string" && from.startsWith("/") ? from : "/";
        if (draft) {
          navigate(safeReturn, { state: { draft } });
        } else {
          navigate(safeReturn);
        }
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Authentication failed"));
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

  // Switch into the "forgot password" flow, pre-filling whatever email was
  // already typed on the password step.
  const openForgotPassword = () => {
    setForgotEmail(formData.email);
    setResetEmailSent(false);
    setStep("forgot");
  };

  const backToSignIn = () => {
    setStep("email");
    setResetEmailSent(false);
    setFormData({ ...formData, password: "" });
  };

  const handleForgotPasswordSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Please enter your email");
      return;
    }

    setIsSendingReset(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail.trim() });
      setResetEmailSent(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to send the recovery email right now."));
    } finally {
      setIsSendingReset(false);
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
    } else if (step === "forgot") {
      return "We'll email you a secure link to reset it";
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
            {step === "forgot"
              ? "Reset your password"
              : mode === "login"
                ? "Welcome Back!"
                : "Join the Community"}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">{getMessage()}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 dark:bg-zinc-900 dark:border-zinc-800">
          {/* Tabs - Only show on email step */}
          {step === "email" && (
            <div className="flex gap-2 mb-8 bg-zinc-100 p-1 rounded-xl dark:bg-zinc-800">
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                  mode === "login"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => switchMode("signup")}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                  mode === "signup"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Progress Indicator */}
          {step !== "email" && step !== "forgot" && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-zinc-50"
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
                          ? "bg-zinc-900 dark:bg-zinc-100"
                          : "bg-zinc-200 dark:bg-zinc-700"
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
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  {mode === "signup" ? "Email Address" : "Email or Username"}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Mail size={20} />
                  </div>
                  <input
                    autoFocus
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
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
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <UserIcon size={20} />
                  </div>
                  <input
                    autoFocus
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
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
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Lock size={20} />
                  </div>
                  <input
                    autoFocus
                    className="w-full pl-12 pr-12 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
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
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Must be at least 8 characters
                  </p>
                )}
              </div>

              {mode === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-sm text-zinc-900 hover:text-zinc-950 font-medium dark:text-zinc-100 dark:hover:text-white"
                  >
                    Forgot password?
                  </button>
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

          {/* STEP: Forgot password */}
          {step === "forgot" && (
            resetEmailSent ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
                <CheckCircle2 className="mx-auto mb-3 text-emerald-600 dark:text-emerald-400" size={36} />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Check your inbox</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  If that email is registered, we've sent a link to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => handleForgotPasswordSubmit()}
                  disabled={isSendingReset}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                >
                  {isSendingReset ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    "Resend email"
                  )}
                </button>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={backToSignIn}
                    className="inline-flex items-center gap-2 text-sm font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    <ArrowLeft size={16} />
                    Back to sign in
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors -mt-2 mb-2 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  <ArrowLeft size={16} />
                  Back to sign in
                </button>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Mail size={20} />
                    </div>
                    <input
                      autoFocus
                      type="email"
                      className="w-full pl-12 pr-4 py-3 bg-zinc-50 rounded-xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-base dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSendingReset ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending link...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>
            )
          )}

          {/* Footer - Only show on email step */}
          {step === "email" && (
            <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() =>
                  switchMode(mode === "login" ? "signup" : "login")
                }
                className="text-zinc-900 hover:text-zinc-950 font-bold dark:text-zinc-100 dark:hover:text-white"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
