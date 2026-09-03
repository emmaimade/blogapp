import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { X, Search, Inbox, Filter, ChevronDown } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { Sidebar } from '../components/Sidebar';
import { PageLoader } from '../components/PageLoader';
import { Pagination } from '../components/Pagination';
import { usePagedPosts } from '../hooks/usePagedPosts';
import type { PaginatedPosts } from '../types/post';

export const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const filterParam = searchParams.get('filter') || 'all';
  const tagParam = searchParams.get('tag') || '';
  const sortBy = (searchParams.get('sort') === 'popular' ? 'popular' : 'latest') as 'latest' | 'popular';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const {
    posts: filteredPosts,
    total,
    totalPages,
    pageSize,
    isLoading,
    isFetching,
  } = usePagedPosts(
    ['posts', filterParam, tagParam, sortBy],
    '/posts/',
    {
      filter: filterParam !== 'all' ? filterParam : undefined,
      tag: tagParam || undefined,
      sort: sortBy,
    },
    page,
  );

  // Tags and "popular" sidebar content are independent of the current page of
  // results — deriving them from `filteredPosts` (as before pagination) would
  // only reflect whatever page happens to be loaded, not the whole blog.
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/tags/')).data,
    staleTime: 5 * 60 * 1000,
  });
  const tags = useMemo(
    () => Array.from(new Set((tagsData || []).map((t: { name: string }) => t.name))).sort() as string[],
    [tagsData],
  );

  const { data: popularData } = useQuery<PaginatedPosts>({
    queryKey: ['posts', 'sidebar-popular'],
    queryFn: async () => (await api.get('/posts/', { params: { sort: 'popular', limit: 5 } })).data,
    staleTime: 5 * 60 * 1000,
  });
  const popularPosts = popularData?.items ?? [];

  // Changing filter, tag, or sort restarts pagination — page 3 of the old
  // result set has no guaranteed meaning against a new one.
  const setFilter = (f: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('filter', f);
    next.delete('page');
    setSearchParams(next);
  };

  const setTag = (t: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!t) next.delete('tag');
    else next.set('tag', t);
    next.delete('page');
    setSearchParams(next);
    setShowTagDropdown(false);
  };

  const setSortBy = (s: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('sort', s);
    next.delete('page');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  if (isLoading) {
    return <PageLoader label="Loading articles" />;
  }

  const hasActiveFilters = filterParam !== 'all' || tagParam;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Controls Bar */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            {/* Left: Type & Sorting */}
            <div className="flex gap-3 flex-wrap">
              {/* Type Toggle */}
              <div className="inline-grid grid-cols-2 gap-2 bg-white rounded-lg p-1 border border-zinc-200 shadow-sm">
                <button
                  onClick={() => setFilter('all')}
                  className={
                    filterParam === 'all'
                      ? 'px-4 py-2 rounded-md font-bold text-sm transition-all bg-primary text-white'
                      : 'px-4 py-2 rounded-md font-bold text-sm transition-all text-zinc-600 hover:bg-zinc-50'
                  }
                >
                  All Posts
                </button>
                <button
                  onClick={() => setFilter('projects')}
                  className={
                    filterParam === 'projects'
                      ? 'px-4 py-2 rounded-md font-bold text-sm transition-all bg-primary text-white'
                      : 'px-4 py-2 rounded-md font-bold text-sm transition-all text-zinc-600 hover:bg-zinc-50'
                  }
                >
                  Projects
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular')}
                className="px-4 py-2 bg-white border border-zinc-200 rounded-lg font-medium text-sm text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm cursor-pointer"
              >
                <option value="latest">Latest</option>
                <option value="popular">Popular</option>
              </select>
            </div>

            {/* Right: Tag Filter */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                aria-expanded={showTagDropdown}
                aria-haspopup="menu"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg font-medium text-sm text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm whitespace-nowrap"
              >
                <Filter size={16} />
                Tags
                {tagParam && <span className="w-2 h-2 bg-primary rounded-full"></span>}
                <ChevronDown size={16} className={`transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Tag Dropdown Menu */}
              {showTagDropdown && (
                <>
                  {/* Backdrop — closes the menu on outside click */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowTagDropdown(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                  >
                    <button
                      role="menuitem"
                      onClick={() => setTag('')}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                        !tagParam
                          ? 'bg-primary text-white'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      All Tags
                    </button>
                    {tags.map((t) => (
                      <button
                        key={t}
                        role="menuitem"
                        onClick={() => setTag(t)}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-t border-zinc-100 ${
                          tagParam === t
                            ? 'bg-primary text-white'
                            : 'text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Active Filters Indicator */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-medium border border-primary/20">
                <Filter size={14} />
                <span>Filters active</span>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-zinc-600 hover:text-zinc-900 font-medium underline transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

          {/* Posts List */}
          <div className="lg:col-span-8">
            {filteredPosts && filteredPosts.length > 0 ? (
              <div className={`space-y-8 transition-opacity ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <>
                {/* Enhanced Empty State */}
                <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-16 text-center shadow-sm">
                  <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    {tagParam ? (
                      <Search className="text-zinc-400" size={32} />
                    ) : (
                      <Inbox className="text-zinc-400" size={32} />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900 mb-3">
                    No posts found
                  </h3>
                  <p className="text-zinc-600 mb-8 max-w-md mx-auto">
                    {tagParam
                      ? `We couldn't find any posts tagged with "${tagParam}". Try a different tag or view all posts.`
                      : filterParam === 'projects'
                        ? 'No projects have been published yet. Check back soon!'
                        : 'No posts available yet. Check back for new content!'
                    }
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10"
                    >
                      <X size={18} />
                      Clear All Filters
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Pagination */}
            {filteredPosts.length > 0 && (
              <div className="mt-12 flex flex-col items-center gap-4">
                <p className="text-sm text-zinc-500">
                  Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
                </p>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <Sidebar popularPosts={popularPosts} tags={tags} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogList;
