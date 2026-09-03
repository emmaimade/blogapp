import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, Loader2, ArrowLeft, X } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { PageLoader } from '../components/PageLoader';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts';

export const SearchResults: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const tagParam = searchParams.get('tag') || '';
  const [searchTerm, setSearchTerm] = useState(query);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const {
    posts: results,
    total,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedPosts(
    ['search', query, tagParam],
    '/posts/search',
    { q: query || undefined, tag: tagParam || undefined },
    !!query,
  );

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/tags/')).data,
  });
  const availableTags: string[] = Array.from(
    new Set((tagsData || []).map((t: { name: string }) => t.name)),
  ).sort() as string[];

  const { data: popularTags } = useQuery({
    queryKey: ['popularTags'],
    queryFn: async () => (await api.get('/tags/popular?limit=6')).data,
  });

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      const next = new URLSearchParams(searchParams);
      next.set('q', searchTerm.trim());
      setSearchParams(next);
    }
  };

  const setTagFilter = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    if (tag) next.set('tag', tag);
    else next.delete('tag');
    setSearchParams(next);
    setShowTagDropdown(false);
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
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-zinc-600">
                {isLoading ? (
                  'Searching...'
                ) : (
                  <>
                    Found <span className="font-bold text-zinc-900">{total}</span> result
                    {total !== 1 ? 's' : ''} for "{query}"
                    {tagParam && <> tagged "{tagParam}"</>}
                  </>
                )}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown((open) => !open)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all"
              >
                <Filter size={16} />
                {tagParam || 'Filter by tag'}
                {tagParam && (
                  <X
                    size={14}
                    className="hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagFilter('');
                    }}
                  />
                )}
                <ChevronDown size={16} className={`transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showTagDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => setTagFilter('')}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      !tagParam ? 'bg-primary text-white' : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    All Tags
                  </button>
                  {availableTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(t)}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-t border-zinc-100 ${
                        tagParam === t ? 'bg-primary text-white' : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <PageLoader label="Searching posts" minHeight="18rem" />
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

      {/* Popular Tags — real tags for this blog, not placeholder topics */}
      {!query && popularTags?.length > 0 && (
        <div className="mt-12 bg-white rounded-3xl p-8 border border-zinc-100">
          <h3 className="text-lg font-bold text-zinc-900 mb-4">Popular Tags</h3>
          <div className="flex flex-wrap gap-3">
            {popularTags.map((tag: { id: number; name: string }) => (
              <Link
                key={tag.id}
                to={`/tag/${tag.name}`}
                className="px-4 py-2 bg-zinc-50 hover:bg-zinc-50 hover:text-primary rounded-full text-sm font-medium transition-all"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
