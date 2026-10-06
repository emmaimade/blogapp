import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { usePageMeta } from "../shared/hooks/usePageMeta";

const ADMIN_STUDIO_URL = import.meta.env.VITE_ADMIN_STUDIO_URL || "http://localhost:5173";

// Signup itself now runs entirely on admin-studio's origin (see
// frontend/admin-studio/src/features/auth/pages/SignupPage.tsx) — that's
// what lets the backend's session cookie land as a same-origin, first-party
// cookie there. This page is just the redirect target for existing links
// (e.g. /signup, /signup?invite=TOKEN).
export const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  usePageMeta(
    "Sign up",
    "Start your 14-day free trial of Inko, no credit card required."
  );

  useEffect(() => {
    window.location.replace(
      inviteToken ? `${ADMIN_STUDIO_URL}/join/${inviteToken}` : `${ADMIN_STUDIO_URL}/signup`
    );
  }, [inviteToken]);

  return (
    <div className="w-full max-w-[460px] bg-white rounded-2xl border border-zinc-200/80 p-10 shadow-[0_12px_40px_rgba(0,0,0,0.03)] flex flex-col items-center gap-3">
      <Loader2 className="animate-spin text-violet-600" size={28} />
      <p className="text-sm text-zinc-500">Taking you to sign up...</p>
    </div>
  );
};
