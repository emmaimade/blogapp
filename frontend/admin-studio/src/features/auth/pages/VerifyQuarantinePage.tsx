import { useState } from "react";
import { useAuth } from "../context/AuthContext"; // Matches your useAuth context path
import { authSession } from "../lib/session";     // Matches your session utility path
import { Mail, Loader2, Send, LogOut } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const VerifyQuarantinePage = () => {
  const { user, logout } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleResend = async () => {
    if (!user?.email) return;
    setIsSending(true);
    setStatusMessage(null);

    try {
      const res = await axios.post(`${API_URL}/auth/send-verification`, {
        email: user.email,
      });
      setStatusMessage({ 
        type: "success", 
        text: res.data.message || "A fresh verification link has been sent to your inbox." 
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.detail || "Failed to trigger the verification email. Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = () => {
    authSession.clearToken();
    logout();
    window.location.href = "/admin/login";
  };

  return (
    <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl shadow-zinc-200/80 border border-zinc-100 p-8 md:p-10 text-center transition-all">
      <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl w-fit mx-auto mb-6">
        <Mail size={32} />
      </div>

      <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-2">
        Verify your email
      </h1>
      <p className="text-zinc-500 text-sm leading-relaxed mb-6">
        Before you can access your Admin Studio dashboard, you need to confirm your account identity. 
        We sent an email to <strong className="text-zinc-800 font-semibold">{user?.email || "your inbox"}</strong>.
      </p>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border mb-6 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleResend}
          disabled={isSending}
          className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-semibold py-3 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-purple-900/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Sending Link...
            </>
          ) : (
            <>
              <Send size={15} /> Resend verification email
            </>
          )}
        </button>

        <button
          onClick={handleSignOut}
          className="w-full border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
        >
          <LogOut size={14} /> Sign out of account
        </button>
      </div>
    </div>
  );
};