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
  Eye,
  EyeOff,
} from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ADMIN_STUDIO_URL = import.meta.env.VITE_ADMIN_STUDIO_URL || "http://localhost:5173";

export const SignupPage = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    workspaceName: "",
    workspaceSlug: "",
  });

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Automatic Workspace URL Slug Generation Hook
  useEffect(() => {
    if (formData.workspaceName) {
      const generated = formData.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormData((prev) => ({ ...prev, workspaceSlug: generated }));
    } else {
      setFormData((prev) => ({ ...prev, workspaceSlug: "" }));
    }
  }, [formData.workspaceName]);

  // Debounced API Availability Check (Points directly to your new Auth router endpoint)
  useEffect(() => {
    if (!formData.workspaceSlug) {
      setSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      setError("");
      try {
        // MATCHED ROUTE: Hits your newly created endpoint in auth router
        const res = await axios.get(
          `${API_URL}/auth/check-slug?slug=${formData.workspaceSlug}`
        );
        setSlugAvailable(res.data.available);
      } catch (err: any) {
        console.error("Slug check connection error:", err);
        setSlugAvailable(false);
        setError("Unable to verify workspace availability with the server.");
      } finally {
        setCheckingSlug(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.workspaceSlug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    setFormData((prev) => ({ ...prev, workspaceSlug: value }));
  };

  // Real-time metrics check mapping out complex regex states
  const passwordRequirements = {
    hasMinLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };

  const validateStep1 = () => {
    const isPasswordValid = 
      passwordRequirements.hasMinLength &&
      passwordRequirements.hasUppercase &&
      passwordRequirements.hasNumber &&
      passwordRequirements.hasSpecial;

    return (
      formData.firstName.trim() !== "" &&
      formData.lastName.trim() !== "" &&
      formData.email.trim() !== "" &&
      isPasswordValid &&
      formData.password === formData.confirmPassword
    );
  };

  const canSubmit = () => {
    return (
      formData.workspaceName.trim() !== "" &&
      formData.workspaceSlug.trim() !== "" &&
      slugAvailable === true
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setIsLoading(true);
    setError("");

    try {
      // MATCHED ROUTE: Calls user registration system endpoint
      await axios.post(`${API_URL}/users/register`, {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        workspace_name: formData.workspaceName.trim(),
        workspace_slug: formData.workspaceSlug.trim(),
      });

      const loginFormData = new URLSearchParams();
      loginFormData.append("username", formData.email.trim());
      loginFormData.append("password", formData.password);

      const loginRes = await axios.post(`${API_URL}/auth/login`, loginFormData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { access_token } = loginRes.data;

      window.location.href = `${ADMIN_STUDIO_URL}/auth/callback?token=${access_token}&next=/admin/onboarding`;
    } catch (err: any) {
      const backendDetail = err.response?.data?.detail;

      if (Array.isArray(backendDetail)) {
        // If it's a FastAPI validation array, grab the message from the first error object
        setError(backendDetail[0]?.msg || "Validation error occurred.");
      } else if (typeof backendDetail === "string") {
        setError(backendDetail);
      } else {
        setError("An unexpected error occurred during profile setup.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] bg-white rounded-2xl border border-zinc-200/80 p-8 md:p-10 shadow-[0_12px_40px_rgba(0,0,0,0.03)] transition-all">
      
      {/* Flow Stepper Tracker Line */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
          <span>Account Setup</span>
          <span>Step {step} of 2</span>
        </div>
        <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-violet-600 transition-all duration-300 rounded-full" 
            style={{ width: `${step * 50}%` }}
          />
        </div>
      </div>

      {/* Context Headers */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {step === 1 ? "Create your account" : "Configure your workspace"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
          {step === 1 
            ? "Provide your details to build your administrator identity." 
            : "Specify your public directory URL parameters below."}
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 ? (
          <>
            {/* Name Fields Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">First Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Jane"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setIsPasswordFocused(true)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-11 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Requirement Matrix Dashboard Popover */}
              {isPasswordFocused || formData.password.length > 0 ? (
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl space-y-1.5 mt-1.5 transition-all">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Password Requirements</p>
                  <div className="grid grid-col gap-x-2 gap-y-1 text-xs font-medium">
                    <span className={`flex items-center gap-1 ${passwordRequirements.hasMinLength ? "text-emerald-600" : "text-zinc-400"}`}>
                      <Check size={10} className={passwordRequirements.hasMinLength ? "opacity-100" : "opacity-40"} /> 8+ Characters
                    </span>
                    <span className={`flex items-center gap-1 ${passwordRequirements.hasUppercase ? "text-emerald-600" : "text-zinc-400"}`}>
                      <Check size={10} className={passwordRequirements.hasUppercase ? "opacity-100" : "opacity-40"} /> Uppercase Letter
                    </span>
                    <span className={`flex items-center gap-1 ${passwordRequirements.hasNumber ? "text-emerald-600" : "text-zinc-400"}`}>
                      <Check size={10} className={passwordRequirements.hasNumber ? "opacity-100" : "opacity-40"} /> One Number
                    </span>
                    <span className={`flex items-center gap-1 ${passwordRequirements.hasSpecial ? "text-emerald-600" : "text-zinc-400"}`}>
                      <Check size={10} className={passwordRequirements.hasSpecial ? "opacity-100" : "opacity-40"} /> Special Character
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 leading-normal pl-1">
                  Must be 8 characters with uppercase, number and special character
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  className="w-full pl-10 pr-11 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 pl-1">Passwords do not match.</p>
              )}
            </div>

            {/* Step 1 Completion Guard Action Button */}
            <button
              type="button"
              disabled={!validateStep1()}
              onClick={() => setStep(2)}
              className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              Continue <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            {/* Workspace Name Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Workspace Name</label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="text"
                  name="workspaceName"
                  required
                  value={formData.workspaceName}
                  onChange={handleChange}
                  placeholder="Acme Corp Engineering"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Workspace Slug Subdomain Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Workspace Subdomain URL</label>
              <div className="relative">
                <input
                  type="text"
                  name="workspaceSlug"
                  required
                  value={formData.workspaceSlug}
                  onChange={handleSlugChange}
                  placeholder="acme-engineering"
                  className="w-full pl-4 pr-24 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400 select-none">
                  <span>.inko.blog</span>
                  {checkingSlug && <Loader2 className="animate-spin text-zinc-400" size={12} />}
                  {!checkingSlug && slugAvailable === true && <Check size={14} className="text-emerald-500 font-bold" />}
                  {!checkingSlug && slugAvailable === false && <X size={14} className="text-red-500 font-bold" />}
                </div>
              </div>
              {slugAvailable === false && (
                <p className="text-xs text-red-500 font-medium pl-1">This subdomain slug is already taken.</p>
              )}
            </div>

            {/* Navigation and Submission Control Bar */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-sm"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="submit"
                disabled={isLoading || !canSubmit()}
                className="flex-1 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  "Create account"
                )}
              </button>
            </div>
          </>
        )}
      </form>

      <p className="text-center text-sm text-zinc-500 mt-8">
        Already have an account?{" "}
        <a
          href={ADMIN_STUDIO_URL}
          className="text-violet-600 font-bold hover:underline"
        >
          Log in
        </a>
      </p>
    </div>
  );
};