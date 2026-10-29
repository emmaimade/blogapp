import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import api from '../api/blogApi';
import { useTenant } from '../contexts/TenantContext';

interface RecommendedBlog {
  id: number;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  url: string;
}

/** Other Inko blogs this blog's owner recommends. Hidden when they recommend none. */
export const RecommendedReads = ({ className = '' }: { className?: string }) => {
  const { blog } = useTenant();
  const { data: blogs = [] } = useQuery<RecommendedBlog[]>({
    queryKey: ['recommendations', blog?.id],
    queryFn: async () => (await api.get(`/blogs/${blog!.id}/recommendations`)).data,
    enabled: !!blog?.id,
    staleTime: 10 * 60 * 1000,
  });

  if (blogs.length === 0) return null;

  return (
    <section aria-labelledby="recommended-reads" className={className}>
      <h2 id="recommended-reads" className="mb-6 text-2xl font-bold text-zinc-900 lg:text-center dark:text-zinc-50">
        Recommended reads
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blogs.map((recommended) => (
          <li key={recommended.id}>
            <a
              href={recommended.url}
              target="_blank"
              rel="noopener"
              className="card group flex h-full items-start gap-3 p-4 transition hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700"
            >
              {recommended.logo_url ? (
                <img src={recommended.logo_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                  {recommended.name.charAt(0)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-zinc-900 group-hover:text-primary transition-colors dark:text-zinc-50">
                  {recommended.name}
                </span>
                {recommended.tagline && (
                  <span className="mt-0.5 block text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">{recommended.tagline}</span>
                )}
              </span>
              <ArrowUpRight size={16} className="shrink-0 text-zinc-400 group-hover:text-primary" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
