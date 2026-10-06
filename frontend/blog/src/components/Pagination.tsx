import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageToken = number | 'ellipsis';

const getPageNumbers = (current: number, total: number): PageToken[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: PageToken[] = [1];
  if (current > 3) pages.push('ellipsis');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);

  return pages;
};

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-all dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-zinc-400 select-none">
            &hellip;
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={
              p === page
                ? 'min-w-9 h-9 px-2 rounded-lg font-bold text-sm bg-primary text-white transition-all'
                : 'min-w-9 h-9 px-2 rounded-lg font-bold text-sm text-zinc-600 hover:bg-zinc-50 transition-all dark:text-zinc-400 dark:hover:bg-zinc-800'
            }
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-all dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
};
