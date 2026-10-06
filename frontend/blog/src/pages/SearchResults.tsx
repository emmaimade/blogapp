import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, ArrowLeft, X } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { PageLoader } from '../components/PageLoader';
import { Pagination } from '../components/Pagination';
import { usePagedPosts, usePageParam } from '../hooks/usePagedPosts';
import { usePageMeta } from '../hooks/usePageMeta';
import { tagUrl } from '../utils/posts';

export const SearchResults: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const tagParam = searchParams.get('tag') || '';
  usePageMeta(query ? `Search results for “${query}”` : 'Search');
  const [searchTerm, setSearchTerm] = useState(query);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const { page, setPage } = usePageParam();
  const {
    posts: results,
    total,
    totalPages,
    pageSize,
    isLoading,
    isFetching,
  } = usePagedPosts(
    ['search', query, tagParam],
    '/posts/search',
    { q: query || undefined, tag: tagParam || undefined },
    page,
    Boolean(query),
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
      next.delete('page');
      setSearchParams(next);
    }
  };

  const setTagFilter = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    if (tag) next.set('tag', tag);
    else next.delete('tag');
    next.delete('page');
    setSearchParams(next);
    setShowTagDropdown(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-primary mb-8 font-medium transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Home
      </Link>

      {/* Search Box */}
      <div className="mb-12">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-50 mb-6">Search Posts</h1>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for posts..."
            className="w-full px-6 py-4 pr-32 rounded-2xl border-2 border-zinc-200 focus:border-primary outline-none transition-all text-lg dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
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
              <p className="text-zinc-600 dark:text-zinc-400">
                {isLoading ? (
                  'Searching...'
                ) : (
                  <>
                    Found <span className="font-bold text-zinc-900 dark:text-zinc-50">{total}</span> result
                    {total !== 1 ? 's' : ''} for "{query}"
                    {tagParam && <> tagged "{tagParam}"</>}
                  </>
                )}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown((open) => !open)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
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
                <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto dark:bg-zinc-900 dark:border-zinc-800">
                  <button
                    onClick={() => setTagFilter('')}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      !tagParam ? 'bg-primary text-white' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    All Tags
                  </button>
                  {availableTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(t)}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-t border-zinc-100 dark:border-zinc-800 ${
                        tagParam === t ? 'bg-primary text-white' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
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
              <div className={`divide-y divide-zinc-200 dark:divide-zinc-800 transition-opacity ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
                {results.map((post) => (
                  <PostCard key={post.id} post={post} variant="feed" />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-12 flex flex-col items-center gap-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
                  </p>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700">
              <Search className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" size={64} />
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                No results found
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
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
                  onClick={() => {
                    setSearchTerm('');
                    setSearchParams({});
                  }}
                  className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-full font-bold hover:bg-zinc-200 transition-all dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
          <Search className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" size={64} />
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Start Searching
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Enter keywords to find relevant posts
          </p>
        </div>
      )}

      {/* Popular Tags — real tags for this blog, not placeholder topics */}
      {!query && popularTags?.length > 0 && (
        <div className="card mt-12 p-8">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">Popular Tags</h3>
          <div className="flex flex-wrap gap-3">
            {popularTags.map((tag: { id: number; name: string }) => (
              <Link
                key={tag.id}
                to={tagUrl(tag.name)}
                className="px-4 py-2 bg-zinc-100 text-zinc-700 hover:bg-primary/10 hover:text-primary rounded-full text-sm font-medium transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-primary/20"
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
