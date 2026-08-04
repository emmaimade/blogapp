import React from 'react';

interface SettingsSkeletonProps {
  cardsCount?: number;
  fieldsPerCard?: number;
}

export const SettingsSkeleton: React.FC<SettingsSkeletonProps> = ({
  cardsCount = 3,
  fieldsPerCard = 2,
}) => {
  return (
    <div className="max-w-4xl animate-pulse space-y-6 pb-24">
      {/* Tip Banner Skeleton */}
      <div className="mb-8 flex items-start gap-3 p-4 bg-zinc-100 rounded-xl dark:bg-zinc-800/50">
        <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2 w-full">
          <div className="h-5 w-48 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-3/4 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Dynamic Form Blocks */}
      {[...Array(cardsCount)].map((_, cardIdx) => (
        <div
          key={cardIdx}
          className="bg-white rounded-xl border border-zinc-200 p-6 dark:bg-zinc-900/50 dark:border-zinc-800"
        >
          {/* Card Title */}
          <div className="h-6 w-36 rounded-md bg-zinc-200 dark:bg-zinc-800 mb-6" />
          
          {/* Card Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(fieldsPerCard)].map((_, fieldIdx) => (
              <div key={fieldIdx} className="space-y-2">
                <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-12 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};