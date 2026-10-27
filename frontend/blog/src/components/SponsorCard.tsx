import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import api from '../api/blogApi';
import { useTenant } from '../contexts/TenantContext';

interface Sponsor {
  id: number;
  name: string;
  logo_url: string | null;
  tagline: string;
  click_url: string;
}

/**
 * A sponsor the blog's owner is running here, if any — labelled "Sponsored"
 * (a disclosure, not decoration). The link goes through the API's click
 * counter, marked rel="sponsored" as search engines ask of paid links.
 * Showing it counts one impression.
 */
export const SponsorCard = ({ placement, className = '' }: { placement: 'post_end' | 'home'; className?: string }) => {
  const { blog } = useTenant();
  const { data: sponsor } = useQuery<Sponsor | null>({
    queryKey: ['sponsor', blog?.id, placement],
    queryFn: async () => (await api.get(`/blogs/${blog!.id}/sponsors/active`, { params: { placement } })).data,
    enabled: !!blog?.id,
    staleTime: 5 * 60 * 1000,
  });

  const counted = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!sponsor || counted.current === sponsor.id) return;
    counted.current = sponsor.id;
    api.post(`/sponsors/${sponsor.id}/impression`).catch(() => {
      // Best-effort, like view counting.
    });
  }, [sponsor]);

  if (!sponsor) return null;

  return (
    <aside aria-label="Sponsored" className={`card p-5 ${className}`}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Sponsored</p>
      <a
        href={sponsor.click_url}
        target="_blank"
        rel="sponsored noopener"
        className="group flex items-center gap-4"
      >
        {sponsor.logo_url && (
          <img
            src={sponsor.logo_url}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-xl border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-700"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-zinc-900 group-hover:text-primary transition-colors dark:text-zinc-50">{sponsor.name}</p>
          {sponsor.tagline && <p className="text-sm text-zinc-600 dark:text-zinc-400">{sponsor.tagline}</p>}
        </div>
        <ArrowUpRight size={18} className="shrink-0 text-zinc-400 group-hover:text-primary transition-colors" aria-hidden="true" />
      </a>
    </aside>
  );
};
