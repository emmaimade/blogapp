import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  /** Announced to screen readers only — on screen the spinner speaks for itself. */
  label?: string;
  /** Use a shorter viewport height for loaders that sit below other page chrome. */
  minHeight?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ label = 'Loading', minHeight = '60vh' }) => (
  <div role="status" className="flex items-center justify-center" style={{ minHeight }}>
    {/* Fades in only after a short delay, so fast loads go straight to the
        page without a flash of spinner. Neutral grey: this can show before
        the blog's brand colour is known. */}
    <span className="opacity-0 [animation:fadeIn_0.2s_ease-out_0.3s_forwards]" aria-hidden="true">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400 dark:text-zinc-500" />
    </span>
    <span className="sr-only">{label}</span>
  </div>
);
