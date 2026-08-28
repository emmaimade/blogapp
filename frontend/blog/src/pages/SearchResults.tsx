import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, Loader2, ArrowLeft } from 'lucide-react';
import { PostCard } from '../components/PostCard';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(query);

  const {
    posts: results,
    total,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedPosts(['search', query], '/posts/search', { q: query || undefined }, !!query);

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchTerm)}`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-zinc-600 hover:text-primary mb-8 font-medium transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Home
      </Link>

      {/* Search Box */}
      <div className="mb-12">
        <h1 className="text-4xl font-black text-zinc-900 mb-6">Search Posts</h1>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for posts..."
            className="w-full px-6 py-4 pr-32 rounded-2xl border-2 border-zinc-200 focus:border-primary outline-none transition-all text-lg"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover transition-all flex items-center gap-2"
          >
            <Search size={20} />
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      {query && (
        <>
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-zinc-600">
                {isLoading ? (
                  'Searching...'
                ) : (
                  <>
                    Found <span className="font-bold text-zinc-900">{total}</span> result
                    {total !== 1 ? 's' : ''} for "{query}"
                  </>
                )}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all">
              <Filter size={16} />
              Filters
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-zinc-900 mb-4" size={40} />
              <p className="text-zinc-400">Searching posts...</p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="space-y-8">
                {results.map((post) => (
                  <div key={post.id} className="relative">
                    <PostCard post={post} />
                    {/* Highlight search term in title/content if needed */}
                  </div>
                ))}
              </div>

              {hasNextPage && (
                <div className="mt-12 flex justify-center">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="px-8 py-3 bg-white border-2 border-zinc-200 text-zinc-700 rounded-xl font-bold hover:border-zinc-300 hover:text-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isFetchingNextPage && <Loader2 className="animate-spin" size={16} />}
                    Load More Results
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <Search className="mx-auto mb-4 text-zinc-300" size={64} />
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">
                No results found
              </h3>
              <p className="text-zinc-600 mb-6">
                We couldn't find any posts matching "{query}". Try different keywords!
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  to="/"
                  className="bg-primary text-white px-6 py-3 rounded-full font-bold hover:bg-primary-hover transition-all"
                >
                  Browse All Posts
                </Link>
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-full font-bold hover:bg-zinc-200 transition-all"
                >
                  Clear Search
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!query && (
        <div className="text-center py-20">
          <Search className="mx-auto mb-4 text-zinc-300" size={64} />
          <h3 className="text-2xl font-bold text-zinc-900 mb-2">
            Start Searching
          </h3>
          <p className="text-zinc-600">
            Enter keywords to find relevant posts
          </p>
        </div>
      )}

      {/* Popular Searches */}
      {!query && (
        <div className="mt-12 bg-white rounded-3xl p-8 border border-zinc-100">
          <h3 className="text-lg font-bold text-zinc-900 mb-4">Popular Searches</h3>
          <div className="flex flex-wrap gap-3">
            {['React', 'TypeScript', 'FastAPI', 'Python', 'Web Development'].map((term) => (
              <Link
                key={term}
                to={`/search?q=${term}`}
                className="px-4 py-2 bg-zinc-50 hover:bg-zinc-50 hover:text-primary rounded-full text-sm font-medium transition-all"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
