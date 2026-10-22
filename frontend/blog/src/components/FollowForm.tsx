import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import api from '../api/blogApi';
import { getApiErrorMessage } from '../api/errors';
import { useTenant } from '../contexts/TenantContext';

/**
 * "Follow by email": the reader gets a confirmation link, and once confirmed,
 * an email when a new post goes up. The server answers the same way whether
 * or not the address already follows, so the form always ends on
 * "check your inbox".
 */
export const FollowForm = ({ sourcePostId, className = '' }: { sourcePostId?: number; className?: string }) => {
  const { blog } = useTenant();
  const [email, setEmail] = React.useState('');
  // Honeypot: hidden from people (and screen readers), so only bots fill it.
  const [website, setWebsite] = React.useState('');
  const inputId = React.useId();

  const follow = useMutation({
    mutationFn: async () =>
      (await api.post(`/blogs/${blog!.id}/followers`, {
        email: email.trim(),
        source_post_id: sourcePostId ?? null,
        website: website || null,
      })).data,
  });

  if (!blog) return null;

  return (
    <section className={`card p-6 sm:p-8 ${className}`} aria-labelledby={`${inputId}-heading`}>
      {follow.isSuccess ? (
        <div className="flex items-start gap-3" role="status">
          <MailCheck className="mt-0.5 shrink-0 text-primary" size={22} aria-hidden="true" />
          <div>
            <h2 id={`${inputId}-heading`} className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Check your inbox
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              We sent a link to <strong className="font-semibold">{email.trim()}</strong>. Click it to start
              following {blog.name}.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 id={`${inputId}-heading`} className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Follow {blog.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Get an email when a new post goes up. No account needed, and you can unsubscribe anytime.
          </p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              follow.mutate();
            }}
          >
            <label htmlFor={inputId} className="sr-only">Email address</label>
            <input
              id={inputId}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border-2 border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
            />
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <button type="submit" className="btn-primary" disabled={follow.isPending}>
              {follow.isPending ? 'Sending…' : 'Follow'}
            </button>
          </form>
          {follow.isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {getApiErrorMessage(follow.error, "Couldn't sign you up. Please try again.")}
            </p>
          )}
        </>
      )}
    </section>
  );
};
