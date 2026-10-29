import React from 'react';
import { ArrowDown, ArrowUp, EyeOff, Plus, Search, Trash2, Users } from 'lucide-react';
import { MAX_RECOMMENDATIONS, useRecommendations, type RecommendedBlog } from '../hooks/useRecommendations';

const Avatar = ({ blog }: { blog: Pick<RecommendedBlog, 'name' | 'logo_url'> }) =>
  blog.logo_url ? (
    <img src={blog.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
      {blog.name.charAt(0)}
    </span>
  );

/**
 * The owner's recommended blogs: shown to readers right after they confirm
 * a follow (to follow in one tap) and as "Recommended reads" on the blog.
 */
export const RecommendationsTab = () => {
  const { overview, setList, setAllowed, search } = useRecommendations();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<RecommendedBlog[]>([]);

  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const id = window.setTimeout(() => {
      search(term).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(id);
    // `search` is stable in behaviour; re-run only when the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!overview.data) return <div className="h-60 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />;
  const { recommendations, received, allow_recommendations } = overview.data;
  const ids = recommendations.map((r) => r.id);
  const full = ids.length >= MAX_RECOMMENDATIONS;

  const move = (index: number, by: -1 | 1) => {
    const next = [...ids];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setList.mutate(next);
  };

  return (
    <div className="space-y-6">
      <section className="admin-card p-5">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Blogs you recommend</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Readers see these right after they follow you, and can follow them in one tap. They also show as
          “Recommended reads” on your home page. Up to {MAX_RECOMMENDATIONS}, in this order.
        </p>

        {recommendations.length > 0 && (
          <ol className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recommendations.map((r, index) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <Avatar blog={r} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold text-zinc-900 hover:text-violet-600 dark:text-white">
                      {r.name}
                    </a>
                    {!r.shown && (
                      <span title="It isn't taking followers or recommendations right now, so readers don't see it" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        <EyeOff size={11} /> Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    You've sent them {r.followers_sent.toLocaleString()} follower{r.followers_sent === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button type="button" disabled={index === 0 || setList.isPending} onClick={() => move(index, -1)} aria-label={`Move ${r.name} up`}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"><ArrowUp size={15} /></button>
                  <button type="button" disabled={index === ids.length - 1 || setList.isPending} onClick={() => move(index, 1)} aria-label={`Move ${r.name} down`}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"><ArrowDown size={15} /></button>
                  <button type="button" disabled={setList.isPending} onClick={() => setList.mutate(ids.filter((id) => id !== r.id))} aria-label={`Stop recommending ${r.name}`}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {full ? (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">You're recommending {MAX_RECOMMENDATIONS} blogs, the most allowed. Remove one to add another.</p>
        ) : (
          <div className="mt-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an Inko blog by name"
                aria-label="Find a blog to recommend"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            {results.filter((b) => !ids.includes(b.id)).length > 0 && (
              <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {results.filter((b) => !ids.includes(b.id)).map((b) => (
                  <li key={b.id} className="flex items-center gap-3 p-3">
                    <Avatar blog={b} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{b.name}</p>
                      {b.tagline && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{b.tagline}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={setList.isPending}
                      onClick={() => {
                        setList.mutate([...ids, b.id]);
                        setQuery('');
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      <Plus size={13} /> Recommend
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No blogs found that can be recommended. Blogs need a published post, and their follow form on.</p>
            )}
          </div>
        )}
      </section>

      <section className="admin-card p-5">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Blogs recommending you</h2>
        {received.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No other blog recommends yours yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {received.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-medium text-zinc-700 hover:text-violet-600 dark:text-zinc-300">
                  {r.name}
                  {!r.recommends_you_now && <span className="ml-1.5 text-xs font-normal text-zinc-400">(no longer recommends you)</span>}
                </a>
                <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-zinc-900 dark:text-white">
                  <Users size={13} className="text-zinc-400" /> +{r.followers.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Let other blogs recommend you</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {allow_recommendations ? 'Other Inko blogs can find yours and recommend it to their readers.' : "Your blog won't appear in other blogs' searches or recommendations."}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 self-start sm:self-auto">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{allow_recommendations ? 'On' : 'Off'}</span>
          <input type="checkbox" role="switch" className="peer sr-only" checked={allow_recommendations}
            disabled={setAllowed.isPending} onChange={(e) => setAllowed.mutate(e.target.checked)} />
          <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-violet-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-disabled:opacity-50 dark:bg-zinc-700 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
      </section>
    </div>
  );
};
