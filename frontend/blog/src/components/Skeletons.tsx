import React from 'react';

const Block: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />
);

/** Matches PostCard's `feed` variant. */
export const FeedItemSkeleton: React.FC = () => (
  <div className="py-6">
    <Block className="h-6 w-3/4 rounded-lg" />
    <Block className="mt-3 h-4 w-full rounded" />
    <Block className="mt-2 h-4 w-2/3 rounded" />
    <Block className="mt-4 h-3 w-40 rounded" />
  </div>
);

/** Matches PostCard's `compact` variant. */
export const CompactRowSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-6">
    <Block className="h-4 w-24 shrink-0 rounded" />
    <Block className="h-4 w-full max-w-md rounded" />
  </div>
);

/** Matches PostCard's `list` variant. */
export const ListRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 py-3">
    <Block className="h-14 w-14 shrink-0 rounded-lg sm:h-16 sm:w-16" />
    <div className="flex-1">
      <Block className="h-4 w-3/4 rounded" />
      <Block className="mt-2 h-3 w-32 rounded" />
    </div>
  </div>
);

/** Matches PostCard's `card` variant. */
export const GridCardSkeleton: React.FC = () => (
  <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
    <Block className="aspect-video w-full rounded-none" />
    <div className="p-4 flex flex-col gap-2">
      <Block className="h-3 w-20 rounded" />
      <Block className="h-4 w-5/6 rounded" />
      <Block className="h-3 w-16 rounded" />
    </div>
  </div>
);

export const HeroSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl overflow-hidden border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
    <Block className="w-full h-[380px] sm:h-[420px] md:h-[480px] rounded-none" />
  </div>
);

export const ArticleSkeleton: React.FC = () => (
  <div>
    <div className="flex gap-2 mb-4">
      <Block className="h-5 w-16 rounded-full" />
      <Block className="h-5 w-14 rounded-full" />
    </div>
    <Block className="h-10 w-full rounded-lg mb-3" />
    <Block className="h-10 w-2/3 rounded-lg mb-6" />
    <div className="flex items-center gap-6 py-4 border-y border-zinc-100 mb-10 dark:border-zinc-800">
      <Block className="h-9 w-9 rounded-full" />
      <Block className="h-4 w-32 rounded" />
      <Block className="h-4 w-24 rounded" />
    </div>
    <Block className="aspect-video w-full rounded-2xl mb-10" />
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Block key={i} className="h-4 w-full rounded" />
      ))}
      <Block className="h-4 w-2/3 rounded" />
    </div>
  </div>
);

/** The contact page's details card, while settings load. */
export const ContactDetailsSkeleton: React.FC = () => (
  <div className="card p-6">
    <Block className="h-5 w-32 mb-6 rounded" />
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Block className="h-5 w-5 shrink-0 rounded" />
          <div className="flex-1 space-y-2">
            <Block className="h-3 w-16 rounded" />
            <Block className="h-4 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** The contact page's FAQ section, while settings load. */
export const FaqSkeleton: React.FC = () => (
  <div>
    <Block className="h-8 w-72 max-w-full mx-auto mb-8 rounded-lg" />
    <div className="card overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-6 py-5">
          <Block className="h-5 w-2/3 rounded" />
        </div>
      ))}
    </div>
  </div>
);
