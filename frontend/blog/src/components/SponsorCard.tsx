import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import api from '../api/blogApi';
import { useTenant } from '../contexts/TenantContext';
import { useAdvertisePage } from '../hooks/useAdvertisePage';

interface Sponsor {
  id: number;
  name: string;
  logo_url: string | null;
  tagline: string;
  click_url: string;
}

type Placement = 'post_end' | 'home' | 'sidebar';
/** card: in the page flow · sidebar: the post's right-hand column · strip: one line under a post's title (phones) */
type Variant = 'card' | 'sidebar' | 'strip';

const Label = () => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Sponsored</p>
);

/**
 * A sponsor the blog's owner is running here — labelled "Sponsored" (a
 * disclosure, not decoration), linked through the API's click counter with
 * rel="sponsored" as search engines ask of paid links. Showing it counts one
 * impression, so only one variant may be mounted per slot.
 *
 * While the owner's Advertise page is on, the slot also points readers to it:
 * "Advertise here" under a sponsor, and a "your brand here" house ad when no
 * sponsor is running (unless the owner switched house ads off).
 */
export const SponsorCard = ({
  placement,
  variant = 'card',
  className = '',
}: {
  placement: Placement;
  variant?: Variant;
  className?: string;
}) => {
  const { blog } = useTenant();
  const { page: advertise } = useAdvertisePage();
  const { data: sponsor, isLoading } = useQuery<Sponsor | null>({
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

  if (isLoading) return null;

  if (!sponsor) {
    // A house ad for the Advertise page — never as the one-line strip under a
    // title, where an ad for ads would only get in the way of reading.
    if (!advertise?.show_house_ads || variant === 'strip') return null;
    return (
      <aside aria-label="Advertise here" className={`rounded-2xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700 ${className}`}>
        <Megaphone size={20} className="mb-2 text-primary" aria-hidden="true" />
        <p className="font-bold text-zinc-900 dark:text-zinc-50">Your brand here</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {advertise.monthly_readers > 0
            ? `Reach ${advertise.monthly_readers.toLocaleString()} readers a month.`
            : `Reach ${advertise.blog_name}'s readers.`}
        </p>
        <Link to="/advertise" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Advertise here <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </aside>
    );
  }

  const advertiseLink = advertise && (
    <Link to="/advertise" className="text-xs text-zinc-500 hover:text-primary dark:text-zinc-400">
      Advertise here →
    </Link>
  );

  if (variant === 'strip') {
    return (
      <aside aria-label="Sponsored" className={`flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900 ${className}`}>
        <a href={sponsor.click_url} target="_blank" rel="sponsored noopener" className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Sponsored by</span>
          {sponsor.logo_url && <img src={sponsor.logo_url} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />}
          <span className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{sponsor.name}</span>
        </a>
        <ArrowUpRight size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
      </aside>
    );
  }

  if (variant === 'sidebar') {
    return (
      <aside aria-label="Sponsored" className={`card p-5 ${className}`}>
        <Label />
        {sponsor.logo_url && (
          <img
            src={sponsor.logo_url}
            alt=""
            loading="lazy"
            className="mt-3 h-24 w-full rounded-xl border border-zinc-200 bg-white object-contain p-3 dark:border-zinc-700"
          />
        )}
        <p className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-50">{sponsor.name}</p>
        {sponsor.tagline && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{sponsor.tagline}</p>}
        <a href={sponsor.click_url} target="_blank" rel="sponsored noopener" className="btn-primary mt-4 w-full">
          Visit {sponsor.name} <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        {advertiseLink && <div className="mt-3 text-center">{advertiseLink}</div>}
      </aside>
    );
  }

  return (
    <aside aria-label="Sponsored" className={`card p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label />
        {advertiseLink}
      </div>
      <a href={sponsor.click_url} target="_blank" rel="sponsored noopener" className="group flex items-center gap-4">
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
