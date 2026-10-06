import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  label: string;
  /** Use a shorter viewport height for loaders that sit below other page chrome. */
  minHeight?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ label, minHeight = '60vh' }) => (
  <div
    className="flex flex-col items-center justify-center"
    style={{ minHeight }}
  >
    <Loader2 className="animate-spin text-zinc-900 dark:text-zinc-100 mb-4" size={40} />
    <p className="text-zinc-500 dark:text-zinc-400 font-medium tracking-widest uppercase text-xs">
      {label}
    </p>
  </div>
);
