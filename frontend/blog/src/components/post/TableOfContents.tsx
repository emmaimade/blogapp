import React from 'react';
import { ChevronDown, List } from 'lucide-react';

export type TocEntry = { id: string; text: string; level: number };

const TocLinks: React.FC<{ entries: TocEntry[] }> = ({ entries }) => (
  <nav aria-label="On this page" className="space-y-1">
    {entries.map((entry) => (
      <a
        key={entry.id}
        href={`#${entry.id}`}
        className="block text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors py-1"
        style={{ paddingLeft: `${(entry.level - 2) * 12}px` }}
      >
        {entry.text}
      </a>
    ))}
  </nav>
);

/** Sticky sidebar card on desktop. */
export const TableOfContents: React.FC<{ entries: TocEntry[] }> = ({ entries }) => (
  <div className="card hidden lg:block p-6">
    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
      <List size={18} className="text-zinc-900 dark:text-zinc-50" /> On This Page
    </h2>
    {/* Sole occupant of the sticky sidebar, so it can use most of the viewport. */}
    <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
      <TocLinks entries={entries} />
    </div>
  </div>
);

/**
 * Collapsible version above the article below `lg`, where the sidebar would
 * otherwise drop beneath the whole post — exactly where long posts need it.
 */
export const MobileTableOfContents: React.FC<{ entries: TocEntry[] }> = ({ entries }) => (
  <details className="group lg:hidden mb-8 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2">
        <List size={18} /> On this page
      </span>
      <ChevronDown size={18} className="transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
      <TocLinks entries={entries} />
    </div>
  </details>
);
