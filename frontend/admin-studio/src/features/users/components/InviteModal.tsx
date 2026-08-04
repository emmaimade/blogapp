import { useState } from "react";
import { X, Check, Mail, Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../shared/api/client";
import { useBlog } from "../../../app/providers/BlogProvider";
import type { BlogRole } from "../hooks/useUserManager";
import { RoleBadge, ROLE_META } from "./UserComponents";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InviteModal = ({ isOpen, onClose, onSuccess }: InviteModalProps) => {
  const { activeBlog } = useBlog();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BlogRole>("author");
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const handleInvite = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter an email address to invite.");
      return;
    }
    if (!activeBlog?.id) {
      toast.error("No active workspace selected.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post(`/blogs/${activeBlog.id}/invitations`, { email: trimmedEmail, role });
      setSentTo(trimmedEmail);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to send invitation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setSentTo("");
    setRole("author");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Invite team member</h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">We'll email them a link to join — valid for 7 days.</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {sentTo ? (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Check size={15} /> Invitation sent to <span className="font-mono text-xs">{sentTo}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <Mail size={14} className="shrink-0 text-zinc-400" />
              <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-300">
                They'll receive an email with a link to accept as <RoleBadge role={role} />.
              </span>
            </div>
          </div>
        ) : null}

        {!sentTo && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {(["editor", "author"] as BlogRole[]).map((r) => {
                  const { label } = ROLE_META[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-3.5 text-center text-xs font-semibold transition-all ${role === r ? "border-violet-500 bg-violet-5/50 text-violet-800 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
                    >
                      <span className="text-sm font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {role === "editor" && "Can manage posts, tags, and comments."}
                {role === "author" && "Can write and manage their own posts."}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose} className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {isLoading ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        )}

        {sentTo && (
          <button type="button" onClick={handleClose} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Done
          </button>
        )}
      </div>
    </div>
  );
};