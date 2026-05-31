import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Lock,
  Globe,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Building2,
  Users,
  FileText,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { InkoLogo } from "../shared/inko";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ADMIN_STUDIO_URL = import.meta.env.VITE_ADMIN_STUDIO_URL || "http://localhost:5173";

const highlights = [
  { icon: Building2, label: "Multi-tenant workspaces" },
  { icon: Users, label: "Role-based collaboration" },
  { icon: FileText, label: "Full publishing control" },
  { icon: BarChart3, label: "Advanced analytics" },
];


export const SignupPage = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    workspaceName: "",
    workspaceSlug: "",
  });

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak");

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Slug availability check
  useEffect(() => {
    const checkSlug = async () => {
      if (!formData.workspaceSlug || formData.workspaceSlug.length < 3) {
        setSlugAvailable(null);
        return;
      }
      setCheckingSlug(true);
      try {
        const res = await axios.get(`${API_URL}/blogs/check-slug/${formData.workspaceSlug}`);
        setSlugAvailable(res.data.available);
      } catch {
        setSlugAvailable(false);
      } finally {
        setCheckingSlug(false);
      }
    };

    const timeout = setTimeout(checkSlug, 500);
    return () => clearTimeout(timeout);
  }, [formData.workspaceSlug]);

  // Password strength
  useEffect(() => {
    const { password } = formData;
    if (password.length === 0) return setPasswordStrength("weak");

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    setPasswordStrength(score <= 2 ? "weak" : score <= 3 ? "medium" : "strong");
  }, [formData.password]);

  const handleWorkspaceNameChange = (name: string) => {
    setFormData({
      ...formData,
      workspaceName: name,
      workspaceSlug: generateSlug(name),
    });
  };

  const canProceedToStep2 = () =>
    formData.fullName.trim().length >= 2 &&
    formData.email.includes("@") &&
    formData.password.length >= 8;

  const canSubmit = () =>
    formData.workspaceName.trim().length >= 3 &&
    formData.workspaceSlug.length >= 3 &&
    slugAvailable === true;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await axios.post(`${API_URL}/users/register`, {
        username: formData.email.split("@")[0],
        email: formData.email,
        password: formData.password,
        workspace_name: formData.workspaceName,
        workspace_slug: formData.workspaceSlug,
      });

      const loginFormData = new URLSearchParams();
      loginFormData.append("username", formData.email.split("@")[0]);
      loginFormData.append("password", formData.password);

      const loginRes = await axios.post(`${API_URL}/auth/login`, loginFormData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { access_token } = loginRes.data;

      window.location.href = `${ADMIN_STUDIO_URL}/auth/callback?token=${access_token}&next=/admin/onboarding`;
    } catch (err: any) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 pl-12 text-base " +
    "focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 shadow-sm";

  return (
    <div className="min-h-screen flex">
      {/* DARK LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 bg-zinc-900 text-white relative overflow-hidden">
        {/* Decorative Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,92,246,0.25),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.15),_transparent_60%)]" />

        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-3 relative z-10">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-black/50">
            <InkoLogo color="white" size={24} />
          </div>
          <span className="text-3xl font-black tracking-tighter">INKO</span>
        </Link>

        <div className="relative z-10 flex-1 flex flex-col justify-center py-8">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 mb-12 w-fit">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="font-semibold text-sm">
              14-day free trial • No card required
            </span>
          </div>

          <h2 className="text-5xl font-black leading-none tracking-tighter mb-6">
            Publish better.
            <br />
            Together.
          </h2>

          <p className="text-xl text-zinc-400 max-w-md mb-12">
            The modern multi-tenant blog platform for agencies and growing
            teams.
          </p>

          {/* Highlights */}
          <div className="space-y-8 mb-16">
            {highlights.map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
                  <Icon size={24} className="text-violet-400" />
                </div>
                <p className="text-lg text-zinc-300 pt-2.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Light Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 bg-white lg:px-12 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
                <InkoLogo size={20} />
              </div>
              <span className="text-2xl font-black text-zinc-900">INKO</span>
            </Link>
          </div>

          {/* Step Indicator */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-6">
              <div
                className={`flex-1 h-1.5 rounded-full transition-all ${step >= 1 ? "bg-primary" : "bg-zinc-200"}`}
              />
              <div
                className={`flex-1 h-1.5 rounded-full transition-all ${step >= 2 ? "bg-primary" : "bg-zinc-200"}`}
              />
            </div>

            <h1 className="text-4xl font-black tracking-tighter text-zinc-900 mb-3">
              {step === 1 ? "Create your account" : "Set up your workspace"}
            </h1>
            <p className="text-zinc-600 text-lg">
              {step === 1
                ? "Start your free trial"
                : "Choose a name and URL for your blog"}
            </p>
          </div>

          {error && (
            <div className="mb-8 p-5 rounded-2xl bg-red-50 border border-red-100 text-red-700 flex gap-3">
              <X size={22} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-7">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">
                    Full name
                  </label>
                  <div className="relative">
                    <User
                      className="absolute left-5 top-4.5 text-zinc-400"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder="Ada Lovelace"
                      className={inputClass}
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-5 top-4.5 text-zinc-400"
                      size={20}
                    />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      className={inputClass}
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-5 top-4.5 text-zinc-400"
                      size={20}
                    />
                    <input
                      type="password"
                      placeholder="Create a strong password"
                      className={inputClass}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      minLength={8}
                    />
                  </div>

                  {formData.password && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-2 flex-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength === "strong"
                              ? "bg-green-500 w-full"
                              : passwordStrength === "medium"
                                ? "bg-amber-500 w-[66%]"
                                : "bg-red-400 w-[33%]"
                          }`}
                        />
                      </div>
                      <span className="text-sm font-medium capitalize text-zinc-500">
                        {passwordStrength}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2()}
                  className="w-full bg-primary hover:bg-violet-700 active:scale-[0.985] text-white font-semibold py-4 rounded-2xl text-lg shadow-xl shadow-primary/25 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  Continue <ArrowRight size={24} />
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">
                    Workspace name
                  </label>
                  <div className="relative">
                    <Globe
                      className="absolute left-5 top-4.5 text-zinc-400"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder="Acme Marketing Blog"
                      className={inputClass}
                      value={formData.workspaceName}
                      onChange={(e) =>
                        handleWorkspaceNameChange(e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {formData.workspaceSlug && (
                  <div
                    className={`rounded-3xl p-6 border transition-all duration-200 ${
                      slugAvailable === true
                        ? "border-emerald-200 bg-emerald-50"
                        : slugAvailable === false
                          ? "border-red-200 bg-red-50"
                          : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">
                      YOUR BLOG URL
                    </p>
                    <p className="font-mono text-xl font-semibold text-zinc-900 break-all">
                      {formData.workspaceSlug}.inko.blog
                    </p>
                    {checkingSlug && (
                      <p className="text-amber-600 mt-3 text-sm">
                        Checking availability...
                      </p>
                    )}
                    {slugAvailable === true && (
                      <p className="text-emerald-600 mt-3 flex items-center gap-2">
                        <Check size={18} /> Available and ready
                      </p>
                    )}
                    {slugAvailable === false && (
                      <p className="text-red-600 mt-3 flex items-center gap-2">
                        <X size={18} /> Already taken
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-zinc-200 hover:bg-zinc-50 font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={20} /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !canSubmit()}
                    className="flex-1 bg-primary hover:bg-violet-700 active:scale-[0.985] text-white font-semibold py-4 rounded-2xl text-lg shadow-xl shadow-primary/25 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={24} />
                    ) : (
                      "Create workspace"
                    )}
                    {!isLoading && <ArrowRight size={24} />}
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="text-center text-zinc-500 mt-10">
            Already have an account?{" "}
            <a
              href={ADMIN_STUDIO_URL}
              className="text-primary font-semibold hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
