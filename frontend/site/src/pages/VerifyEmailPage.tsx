import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Mail } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ADMIN_STUDIO_URL = import.meta.env.VITE_ADMIN_STUDIO_URL || "http://localhost:5173";

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleResendVerification = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) {
      setResendMessage("Please enter the email address for your account.");
      return;
    }

    setIsResending(true);
    setResendMessage("");

    try {
      await axios.post(`${API_URL}/auth/send-verification`, { email: email.trim() });
      setResendMessage("A new verification email has been sent. Please check your inbox.");
    } catch (err: any) {
      setResendMessage(err.response?.data?.detail || "We could not send a new verification email right now.");
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing from the URL.");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/verify-email?token=${token}`);
        setStatus("success");
        setMessage(res.data.message || "Your email has been successfully verified!");
      } catch (err: any) {
        setStatus("error");
        setMessage(
          err.response?.data?.detail || "This verification link is invalid or has expired."
        );
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div className="w-full max-w-md mx-auto my-16 bg-white rounded-2xl border border-zinc-200/80 p-8 md:p-10 shadow-sm text-center">
      {status === "verifying" && (
        <div className="flex flex-col items-center py-6 space-y-4">
          <Loader2 className="animate-spin text-violet-600" size={40} />
          <h2 className="text-xl font-bold text-zinc-900">Verifying your email...</h2>
          <p className="text-sm text-zinc-500">Please wait while we confirm your identity credentials.</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center py-4 space-y-4">
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Account Verified!</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">{message}</p>
          <a
            href={ADMIN_STUDIO_URL}
            className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            Go to Admin Studio <ArrowRight size={16} />
          </a>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center py-4 space-y-4">
          <div className="p-3 bg-red-50 rounded-full text-red-500">
            <XCircle size={36} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Verification Failed</h2>
          <p className="text-sm text-red-600 bg-red-50/50 border border-red-100 rounded-xl px-4 py-2 text-center leading-relaxed">
            {message}
          </p>

          <form onSubmit={handleResendVerification} className="w-full space-y-3 pt-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-9 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
            <button
              type="submit"
              disabled={isResending}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResending ? "Sending..." : "Resend verification email"}
            </button>
          </form>

          {resendMessage && (
            <p className="text-sm text-emerald-600">{resendMessage}</p>
          )}

          <a
            href={ADMIN_STUDIO_URL}
            className="text-sm font-bold text-violet-600 hover:underline mt-2 block"
          >
            Back to login
          </a>
        </div>
      )}
    </div>
  );
};