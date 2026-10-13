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
    <div className="max-w-4xl animate-pulse space-y-6">
      {/* Dynamic Form Blocks */}
      {[...Array(cardsCount)].map((_, cardIdx) => (
        <div
          key={cardIdx}
          className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
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