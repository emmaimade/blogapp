import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import axios from "axios";
import { API_URL } from "../config";

export interface RecommendedBlog {
  id: number;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  url: string;
}

/**
 * "{Blog} also recommends": shown right after a reader confirms a follow.
 * Nothing is ticked for them; whatever they tick is followed in one go,
 * with the token from the link they just clicked as proof of the address.
 */
export const FollowRecommendations = ({
  blogName,
  token,
  blogs,
}: {
  blogName: string;
  token: string;
  blogs: RecommendedBlog[];
}) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [followed, setFollowed] = useState<string[]>([]);

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const follow = async () => {
    setStatus("working");
    try {
      const res = await axios.post(`${API_URL}/followers/recommendations/follow`, { token, blog_ids: [...selected] });
      setFollowed(res.data.followed);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="w-full rounded-xl bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-800" role="status">
        <CheckCircle2 size={16} className="mb-1 inline-block" />{" "}
        {followed.length > 0
          ? `You're also following ${followed.join(", ")}.`
          : "You were already following those."}
      </div>
    );
  }

  return (
    <div className="w-full border-t border-zinc-100 pt-5 text-left">
      <h2 className="text-sm font-bold text-zinc-900">{blogName} also recommends</h2>
      <ul className="mt-3 space-y-2">
        {blogs.map((blog) => (
          <li key={blog.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 transition hover:border-violet-300 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50">
              <input
                type="checkbox"
                checked={selected.has(blog.id)}
                onChange={() => toggle(blog.id)}
                className="mt-1 accent-violet-600"
              />
              {blog.logo_url && <img src={blog.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-zinc-900">{blog.name}</span>
                {blog.tagline && <span className="block text-xs text-zinc-500">{blog.tagline}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={follow}
        disabled={selected.size === 0 || status === "working"}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "working" && <Loader2 className="animate-spin" size={16} />}
        {selected.size > 1 ? `Follow ${selected.size} blogs` : "Follow selected"}
      </button>
      {status === "error" && (
        <p className="mt-2 text-xs text-red-600" role="alert">Couldn't follow those right now. Please try again.</p>
      )}
    </div>
  );
};
