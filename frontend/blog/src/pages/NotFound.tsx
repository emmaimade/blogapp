import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';

export const NotFound: React.FC = () => {
  usePageMeta('Page not found');
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  // One way to search and one way home — enough to recover without a menu
  // of competing exits.
  return (
    <div className="flex items-center justify-center px-6 py-24 sm:py-32">
      <div className="max-w-xl w-full text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary mb-4">404</p>
        <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 mb-4">
          Page not found
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-10">
          This page doesn't exist or has moved. Try searching for what you were after.
        </p>

        <form onSubmit={handleSearch} role="search" className="relative max-w-md mx-auto mb-8">
          <label htmlFor="not-found-search" className="sr-only">Search posts</label>
          <input
            id="not-found-search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search posts..."
            className="w-full px-5 py-3 pr-14 rounded-xl border-2 border-zinc-300 bg-white focus:border-primary outline-none transition-colors dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Search size={18} />
          </button>
        </form>

        <Link to="/" className="btn-secondary">
          <Home size={18} aria-hidden="true" />
          Go to the homepage
        </Link>
      </div>
    </div>
  );
};
