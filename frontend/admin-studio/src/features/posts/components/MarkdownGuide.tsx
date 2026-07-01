import React from 'react';
import { HelpCircle } from 'lucide-react';

export const MarkdownGuide: React.FC = () => {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle size={18} className="text-primary" />
        <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Markdown Guide</h3>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <div>
          <strong># Heading 1</strong><br />
          <strong>## Heading 2</strong><br />
          <strong>### Heading 3</strong>
        </div>
        <div>
          **Bold**<br />
          *Italic*<br />
          ***Bold + Italic***
        </div>
        <div>
          - Bullet list<br />
          1. Numbered list<br />
          {' > '} Blockquote
        </div>
        <div>
          [Link text](https://example.com)<br />
          ![Alt text](image-url)
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
        💡 Tip: Drag &amp; drop images directly into the editor or use the toolbar button
      </div>
    </div>
  );
};