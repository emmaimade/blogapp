import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Megaphone } from 'lucide-react';
import api from '../api/blogApi';
import { getApiErrorMessage } from '../api/errors';
import { useTenant } from '../contexts/TenantContext';
import { useAdvertisePage } from '../hooks/useAdvertisePage';
import { usePageMeta } from '../hooks/usePageMeta';
import { NotFound } from './NotFound';

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="card p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-1 text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{value.toLocaleString()}</p>
  </div>
);

const inputClass =
  'w-full rounded-xl border-2 border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800';

/** "Advertise with us": the owner's pitch and packages beside live 30-day numbers, and an enquiry form. */
export const Advertise = () => {
  const { blog } = useTenant();
  const { page, isLoading } = useAdvertisePage();
  usePageMeta(page ? `Advertise · ${page.blog_name}` : 'Advertise', 'Reach this blog’s readers.');

  const [form, setForm] = React.useState({ name: '', email: '', company: '', budget: '', message: '', website: '' });
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const enquire = useMutation({
    mutationFn: async () => (await api.post(`/blogs/${blog!.id}/advertise/enquiry`, { ...form, website: form.website || null })).data,
  });

  if (isLoading) return <div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-10" />;
  if (!page) return <NotFound />;

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Megaphone size={22} aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">Advertise with {page.blog_name}</h1>
        {page.intro && <p className="mt-3 max-w-2xl whitespace-pre-line text-zinc-600 dark:text-zinc-400">{page.intro}</p>}
      </header>

      <section aria-labelledby="advertise-audience">
        <h2 id="advertise-audience" className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">Our audience · last 30 days</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Readers" value={page.monthly_readers} />
          <Stat label="Page views" value={page.monthly_views} />
          {page.followers !== null && <Stat label="Email followers" value={page.followers} />}
        </div>

        {(page.sources?.length || page.top_posts?.length) ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {!!page.sources?.length && (
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">Where readers come from</h3>
                <ul className="space-y-2">
                  {page.sources.map(({ source, share }) => (
                    <li key={source}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{source}</span>
                        <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{share < 1 ? '<1' : share}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(share, 1)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!page.top_posts?.length && (
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">Most read</h3>
                <ol className="space-y-2">
                  {page.top_posts.map((post) => (
                    <li key={post.slug} className="flex items-baseline justify-between gap-3 text-sm">
                      <Link to={`/post/${post.slug}`} className="min-w-0 truncate text-zinc-700 hover:text-primary dark:text-zinc-300">
                        {post.title}
                      </Link>
                      <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">{post.views.toLocaleString()} views</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {page.packages.length > 0 && (
        <section aria-labelledby="advertise-packages">
          <h2 id="advertise-packages" className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">Packages</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {page.packages.map((pkg) => (
              <div key={pkg.name} className="card p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{pkg.name}</h3>
                  {pkg.price && <span className="shrink-0 font-semibold text-primary">{pkg.price}</span>}
                </div>
                {pkg.description && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{pkg.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="advertise-contact" className="card p-6 sm:p-8">
        <h2 id="advertise-contact" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Get in touch</h2>
        {enquire.isSuccess ? (
          <div className="mt-4 flex items-start gap-3" role="status">
            <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Thanks — your message is on its way. Expect a reply by email.</p>
          </div>
        ) : (
          <form
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              enquire.mutate();
            }}
          >
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your name
              <input required maxLength={100} value={form.name} onChange={set('name')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
              <input required type="email" value={form.email} onChange={set('email')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Company <span className="font-normal text-zinc-500">(optional)</span>
              <input maxLength={120} value={form.company} onChange={set('company')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Budget <span className="font-normal text-zinc-500">(optional)</span>
              <input maxLength={60} value={form.budget} onChange={set('budget')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-sm font-medium text-zinc-700 sm:col-span-2 dark:text-zinc-300">
              What would you like to run?
              <textarea required maxLength={3000} rows={5} value={form.message} onChange={set('message')} className={`mt-1 ${inputClass}`} />
            </label>
            {/* Honeypot: hidden from people and screen readers, so only bots fill it. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={form.website}
              onChange={set('website')}
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={enquire.isPending}>
                {enquire.isPending ? 'Sending…' : 'Send enquiry'}
              </button>
              {enquire.isError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {getApiErrorMessage(enquire.error, "Couldn't send your enquiry. Please try again.")}
                </p>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
