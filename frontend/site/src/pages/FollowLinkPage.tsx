import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailCheck, MailX, XCircle } from "lucide-react";
import axios from "axios";
import { usePageMeta } from "../shared/hooks/usePageMeta";
import { API_URL } from "../shared/config";
import { FollowRecommendations, type RecommendedBlog } from "../shared/components/FollowRecommendations";

type Kind = "confirm" | "unsubscribe";

const COPY: Record<Kind, {
  title: string;
  description: string;
  prompt: string;
  action: string;
  working: string;
  done: (blog: string) => string;
  doneDetail: string;
}> = {
  confirm: {
    title: "Confirm you want to follow",
    description: "Confirm following a blog on Inko by email.",
    prompt: "Confirm and you'll get an email when a new post goes up.",
    action: "Confirm and follow",
    working: "Confirming...",
    done: (blog) => `You're following ${blog}`,
    doneDetail: "You'll get an email when a new post goes up. Every email has a link to unsubscribe.",
  },
  unsubscribe: {
    title: "Unsubscribe",
    description: "Stop emails from a blog you follow on Inko.",
    prompt: "You'll stop getting emails when new posts go up.",
    action: "Unsubscribe",
    working: "Unsubscribing...",
    done: (blog) => `You've unsubscribed from ${blog}`,
    doneDetail: "You won't get any more emails from this blog. You can follow it again from the blog anytime.",
  },
};

const errorMessage = (err: unknown): string | undefined => {
  if (!axios.isAxiosError(err)) return undefined;
  const detail = err.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
};

/**
 * Where the follow emails' links land: /follow/confirm and /follow/unsubscribe.
 * Nothing happens until the reader presses the button: mail scanners open
 * links on their own, and a link that acted on load would follow or
 * unsubscribe people who never clicked it.
 */
export const FollowLinkPage = ({ kind }: { kind: Kind }) => {
  const copy = COPY[kind];
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">(token ? "idle" : "error");
  const [blogName, setBlogName] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendedBlog[]>([]);
  const [message, setMessage] = useState(token ? "" : "This link is missing part of its address. Try copying the full link from the email.");

  usePageMeta(copy.title, copy.description);

  const submit = async () => {
    setStatus("working");
    try {
      const res = await axios.post(`${API_URL}/followers/${kind}`, { token });
      setBlogName(res.data.blog_name);
      setRecommendations(res.data.recommendations ?? []);
      setStatus("success");
    } catch (err) {
      setMessage(errorMessage(err) || "Something went wrong. Please try the link again.");
      setStatus("error");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-16 bg-white rounded-2xl border border-zinc-200/80 p-8 md:p-10 shadow-sm text-center">
      {(status === "idle" || status === "working") && (
        <div className="flex flex-col items-center py-4 space-y-4">
          <div className="p-3 bg-violet-50 rounded-full text-violet-600">
            {kind === "confirm" ? <MailCheck size={36} /> : <MailX size={36} />}
          </div>
          <h1 className="text-xl font-bold text-zinc-900">{copy.title}</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">{copy.prompt}</p>
          <button
            type="button"
            onClick={submit}
            disabled={status === "working"}
            className="w-full mt-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "working" && <Loader2 className="animate-spin" size={16} />}
            {status === "working" ? copy.working : copy.action}
          </button>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center py-4 space-y-4" role="status">
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">{copy.done(blogName)}</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">{copy.doneDetail}</p>
          {kind === "confirm" && token && recommendations.length > 0 && (
            <FollowRecommendations blogName={blogName} token={token} blogs={recommendations} />
          )}
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center py-4 space-y-4" role="alert">
          <div className="p-3 bg-red-50 rounded-full text-red-500">
            <XCircle size={36} />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">That link didn't work</h1>
          <p className="text-sm text-red-600 bg-red-50/50 border border-red-100 rounded-xl px-4 py-2 leading-relaxed">
            {message}
          </p>
          {kind === "confirm" && (
            <p className="text-sm text-zinc-500 leading-relaxed">
              To get a fresh link, follow the blog again from any of its posts.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
