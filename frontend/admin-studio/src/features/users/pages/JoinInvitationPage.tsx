import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../shared/api/client";
import { useAuth } from "../../auth/context/AuthContext";
import { RoleBadge } from "../components/UserComponents";

interface InvitationInfo {
  blog_name: string;
  blog_slug: string;
  email: string;
  role: "owner" | "editor" | "author";
  expires_at: string;
  already_accepted: boolean;
}

type PageState = "loading" | "ready" | "not_found" | "expired" | "error";

export const JoinInvitationPage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, login } = useAuth();

  const [state, setState] = useState<PageState>("loading");
  const [invite, setInvite] = useState<InvitationInfo | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Inline "no account yet" signup — deliberately skips workspace creation
  // entirely, unlike the marketing site's signup flow, since someone
  // accepting an invite is joining an existing workspace, not starting one.
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [signupData, setSignupData] = useState({ firstName: "", lastName: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupConflict, setSignupConflict] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/invitations/${token}`);
        if (cancelled) return;
        setInvite(res.data);
        setState("ready");
      } catch (err: any) {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 404) setState("not_found");
        else if (status === 410) setState("expired");
        else setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const emailMatches =
    !!user && !!invite && user.email.trim().toLowerCase() === invite.email.trim().toLowerCase();

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    try {
      await api.post(`/invitations/${token}/accept`);
      setJustJoined(true);
      // Brief pause so the success state is actually visible before the
      // full reload — an instant navigate() felt jarring, like nothing
      // happened. The reload itself (rather than client-side routing) is
      // still needed so auth/blog membership state is freshly fetched
      // everywhere (sidebar, blog switcher, dashboard).
      setTimeout(() => window.location.assign("/admin/dashboard"), 1400);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to accept invitation.");
      setIsAccepting(false);
    }
  };

  const handleSignupAndAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSignupError("");
    setIsSigningUp(true);
    try {
      // NEW backend endpoint — creates the User with no Blog attached,
      // accepts this invitation, and returns an access token in one step
      // so there's no separate "now go log in" hop.
      const res = await api.post(`/invitations/${token}/register-and-accept`, {
        first_name: signupData.firstName.trim(),
        last_name: signupData.lastName.trim(),
        password: signupData.password,
      });
      const { access_token, user: userData } = res.data;
      login(access_token, userData);
      setJustJoined(true);
      setTimeout(() => window.location.assign("/admin/dashboard"), 1400);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "";
      // These two specific 400s mean the account/membership already exists —
      // most commonly because an earlier attempt actually succeeded on the
      // server but the response never made it back (e.g. a network/CORS
      // hiccup), so retrying the same form can only ever fail again. Point
      // them at login instead of leaving them stuck on a dead-end form.
      const isAlreadyDone =
        /already been accepted/i.test(detail) || /account with this email already exists/i.test(detail);

      if (isAlreadyDone) {
        setSignupConflict(true);
        setSignupError(
          "Looks like this invitation was already used — you may already have an account. Log in instead.",
        );
      } else {
        setSignupError(detail || "Failed to create your account.");
      }
      setIsSigningUp(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {justJoined && invite && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              You've joined {invite.blog_name}!
            </h2>
            <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Joined as <RoleBadge role={invite.role} />
            </p>
            <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 size={13} className="animate-spin" /> Taking you to your dashboard…
            </p>
          </div>
        )}

        {!justJoined && state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 size={28} className="animate-spin text-violet-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading invitation…</p>
          </div>
        )}

        {state === "not_found" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle size={32} className="text-red-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Invitation not found</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This invitation link doesn't exist or has been revoked by the workspace owner.
            </p>
            <Link to="/admin/login" className="mt-2 text-sm font-semibold text-violet-600 hover:underline">
              Go to login
            </Link>
          </div>
        )}

        {state === "expired" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle size={32} className="text-amber-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Invitation expired</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This invitation link has expired. Ask the workspace owner to send you a new one.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle size={32} className="text-red-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Something went wrong</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              We couldn't load this invitation. Please try again in a moment.
            </p>
          </div>
        )}

        {state === "ready" && invite && invite.already_accepted && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Already accepted</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This invitation to <strong>{invite.blog_name}</strong> has already been accepted.
            </p>
            <Link to="/admin/login" className="mt-2 text-sm font-semibold text-violet-600 hover:underline">
              Go to login
            </Link>
          </div>
        )}

        {!justJoined && state === "ready" && invite && !invite.already_accepted && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
                <Mail size={22} className="text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Join {invite.blog_name}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                You've been invited as {" "}
                <span className="inline-flex align-middle">
                  <RoleBadge role={invite.role} />
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Invited email</p>
              <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-white">{invite.email}</p>
            </div>

            {!user && !showSignupForm && (
              <div className="space-y-3">
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Log in or create an account with <strong>{invite.email}</strong> to accept.
                </p>
                <div className="flex gap-3">
                  <Link
                    to={`/admin/login?redirect=/join/${token}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <LogIn size={15} /> Log in
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowSignupForm(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    <UserPlus size={15} /> Create account
                  </button>
                </div>
              </div>
            )}

            {!user && showSignupForm && signupConflict && (
              <div className="space-y-3 text-center">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
                  {signupError}
                </div>
                <Link
                  to={`/admin/login?redirect=/join/${token}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  <LogIn size={15} /> Log in to continue
                </Link>
              </div>
            )}

            {!user && showSignupForm && !signupConflict && (
              <form onSubmit={handleSignupAndAccept} className="space-y-3">
                {signupError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                    {signupError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="First name"
                    value={signupData.firstName}
                    onChange={(e) => setSignupData((p) => ({ ...p, firstName: e.target.value }))}
                    className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Last name"
                    value={signupData.lastName}
                    onChange={(e) => setSignupData((p) => ({ ...p, lastName: e.target.value }))}
                    className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Create a password"
                    value={signupData.password}
                    onChange={(e) => setSignupData((p) => ({ ...p, password: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 pr-10 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignupForm(false);
                      setSignupError("");
                      setSignupConflict(false);
                    }}
                    className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSigningUp}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isSigningUp ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {isSigningUp ? "Creating account…" : "Create account & join"}
                  </button>
                </div>
              </form>
            )}

            {user && !emailMatches && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  You're logged in as <strong>{user.email}</strong>, but this invitation was sent to{" "}
                  <strong>{invite.email}</strong>.
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Log out and sign in with the invited email address to accept.
                </p>
              </div>
            )}

            {user && emailMatches && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {isAccepting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {isAccepting ? "Joining…" : `Accept and join ${invite.blog_name}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};