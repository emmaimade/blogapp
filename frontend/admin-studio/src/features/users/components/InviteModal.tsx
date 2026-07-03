import { useState } from "react";
import { X, Check, Link2, Copy, Clock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../shared/api/client";
import type { BlogRole } from "../hooks/useUserManager";
import { RoleBadge, ROLE_META } from "./UserComponents";

const SITE_URL = import.meta.env.VITE_SITE_URL || "http://localhost:5174";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InviteModal = ({ isOpen, onClose, onSuccess }: InviteModalProps) => {
  const [role, setRole] = useState<BlogRole>("author");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await api.post("/invitations", { role });
      const token: string = res.data.token;
      setGeneratedLink(`${SITE_URL}/join/${token}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to generate invite link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedLink("");
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
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Generate a link to share with anyone — valid for 7 days.</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {generatedLink ? (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Check size={15} /> Invite link generated for <RoleBadge role={role} />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <Link2 size={14} className="shrink-0 text-zinc-400" />
              <span className="flex-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{generatedLink}</span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${copied ? "bg-emerald-100 text-emerald-700" : "bg-violet-600 text-white hover:bg-violet-700"}`}
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock size={11} /> This link expires in 7 days. Share it privately.
            </p>
          </div>
        ) : null}

        {!generatedLink && (
          <div className="space-y-4">
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
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                {isLoading ? "Generating..." : "Generate Invite Link"}
              </button>
            </div>
          </div>
        )}

        {generatedLink && (
          <button type="button" onClick={handleClose} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Done
          </button>
        )}
      </div>
    </div>
  );
};