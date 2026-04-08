import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Loader2, ArrowLeft } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(query);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query) return [];
      const res = await api.get('/posts/search', {
        params: { q: query }
      });
      return res.data;
    },
    enabled: !!query
  });

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
        className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 mb-8 font-medium transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Home
      </Link>

      {/* Search Box */}
      <div className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 mb-6">Search Posts</h1>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for posts..."
            className="w-full px-6 py-4 pr-32 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none transition-all text-lg"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
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
              <p className="text-slate-600">
                {isLoading ? (
                  'Searching...'
                ) : (
                  <>
                    Found <span className="font-bold text-indigo-600">{results?.length || 0}</span> result
                    {results?.length !== 1 ? 's' : ''} for "{query}"
                  </>
                )}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all">
              <Filter size={16} />
              Filters
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
              <p className="text-slate-400">Searching posts...</p>
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-8">
              {results.map((post: any) => (
                <div key={post.id} className="relative">
                  <PostCard post={post} />
                  {/* Highlight search term in title/content if needed */}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Search className="mx-auto mb-4 text-slate-300" size={64} />
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                No results found
              </h3>
              <p className="text-slate-600 mb-6">
                We couldn't find any posts matching "{query}". Try different keywords!
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  to="/"
                  className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-700 transition-all"
                >
                  Browse All Posts
                </Link>
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-slate-100 text-slate-900 px-6 py-3 rounded-full font-bold hover:bg-slate-200 transition-all"
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
          <Search className="mx-auto mb-4 text-slate-300" size={64} />
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Start Searching
          </h3>
          <p className="text-slate-600">
            Enter keywords to find relevant posts
          </p>
        </div>
      )}

      {/* Popular Searches */}
      {!query && (
        <div className="mt-12 bg-white rounded-3xl p-8 border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Popular Searches</h3>
          <div className="flex flex-wrap gap-3">
            {['React', 'TypeScript', 'FastAPI', 'Python', 'Web Development'].map((term) => (
              <Link
                key={term}
                to={`/search?q=${term}`}
                className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-full text-sm font-medium transition-all"
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