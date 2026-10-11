interface OutlineStarterProps {
  onInsert: (markdown: string) => void;
}

// Plain headings any kind of blog can use. The empty first line is where the
// opening paragraph goes.
const OUTLINES = [
  { label: 'Guide', markdown: "\n\n## What you'll need\n\n## Steps\n\n## Wrapping up\n" },
  { label: 'Story', markdown: '\n\n## How it started\n\n## What happened\n\n## Looking back\n' },
  { label: 'List', markdown: '\n\n## The first one\n\n## The second one\n\n## The third one\n\n## In short\n' },
];

/**
 * Offered only while the post body is empty: one click puts a structure in
 * the editor, and it goes away as soon as there's something written.
 */
export const OutlineStarter = ({ onInsert }: OutlineStarterProps) => (
  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
    <span>Start with an outline:</span>
    {OUTLINES.map((outline) => (
      <button
        key={outline.label}
        type="button"
        onClick={() => onInsert(outline.markdown)}
        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300"
      >
        {outline.label}
      </button>
    ))}
  </div>
);
