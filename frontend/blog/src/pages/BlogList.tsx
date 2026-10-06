import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { X, Search, Inbox, Filter, ChevronDown, Tag as TagIcon } from 'lucide-react';
import api from '../api/blogApi';
import { PostList, PostListSkeleton } from '../components/PostList';
import { Pagination } from '../components/Pagination';
import { usePagedPosts } from '../hooks/usePagedPosts';
import { usePageMeta } from '../hooks/usePageMeta';
import { useBlogStats } from '../hooks/useBlogStats';
import { usePostLayouts } from '../hooks/useSiteSettings';

export const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagParam = searchParams.get('tag') || '';

  // This is also the blog's tag page (`/tag/:tag` redirects here), so a
  // selected tag gets its own title — matching middleware.ts.
  usePageMeta(tagParam ? `Posts tagged “${tagParam}”` : 'Blog');

  // A blog with no projects has no Projects toggle, so a stale
  // `?filter=projects` link just shows the normal list.
  const { hasProjects } = useBlogStats();
  const requestedFilter = searchParams.get('filter') || 'all';
  const filterParam = hasProjects === false ? 'all' : requestedFilter;
  const sortBy = (searchParams.get('sort') === 'popular' ? 'popular' : 'latest') as 'latest' | 'popular';
  const { archiveLayout } = usePostLayouts();
  // Cards need room for three per row; the row layouts keep a reading width.
  const pageWidthClass = archiveLayout === 'cards' ? 'max-w-6xl' : 'max-w-4xl';
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

  // Tags are independent of the current page of results — deriving them from
  // `filteredPosts` would only reflect whatever page happens to be loaded,
  // not the whole blog.
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/tags/')).data,
    staleTime: 5 * 60 * 1000,
  });
  const tags = useMemo(
    () => Array.from(new Set((tagsData || []).map((t: { name: string }) => t.name))).sort() as string[],
    [tagsData],
  );

  // A visible shortcut row for the most-used tags, so readers can filter
  // without opening the "More tags" dropdown at all for common cases.
  const { data: popularTagsData } = useQuery({
    queryKey: ['tags', 'popular', 8],
    queryFn: async () => (await api.get('/tags/popular', { params: { limit: 8 } })).data,
    staleTime: 5 * 60 * 1000,
  });
  const popularTagNames = useMemo(
    () => (popularTagsData || []).map((t: { name: string }) => t.name) as string[],
    [popularTagsData],
  );
  const overflowTagCount = popularTagNames.length > 0 ? Math.max(tags.length - popularTagNames.length, 0) : 0;

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

  const hasActiveFilters = filterParam !== 'all' || tagParam;
  const toggleClass = (active: boolean) => (active ? 'px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-primary text-white' : 'px-4 py-2 rounded-lg font-bold text-sm transition-colors text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50');
  const activeFilterChipClass =
    'inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-semibold border border-primary/20 hover:bg-primary/15 transition-colors dark:bg-primary/20 dark:text-zinc-100';

  if (isLoading) {
    return (
      <div className={`${pageWidthClass} mx-auto px-4 sm:px-6 py-8 sm:py-12`}>
        <PostListSkeleton layout={archiveLayout} count={archiveLayout === 'feed' ? 5 : 9} columns={3} />
      </div>
    );
  }

  return (
    <div>
      <div className={`${pageWidthClass} mx-auto px-4 sm:px-6 py-8 sm:py-12`}>

        {/* Page header — doubles as the tag page when a tag is selected */}
        <div className="mb-8">
          {tagParam ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
                <TagIcon size={16} aria-hidden="true" /> Tag
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-zinc-50 break-words">
                Posts tagged “{tagParam}”
              </h1>
            </>
          ) : (
            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-zinc-50">
              {filterParam === 'projects' ? 'Projects' : 'All posts'}
            </h1>
          )}
          {/* A count only helps when filtering — it says how much there is on a
              topic. On the unfiltered list it just draws attention to size. */}
          {hasActiveFilters && (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {total} {total === 1 ? 'post' : 'posts'}
            </p>
          )}
        </div>

        {/* Controls Bar */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            {/* Left: Type & Sorting */}
            <div className="flex gap-3 flex-wrap">
              {/* Type Toggle — only for blogs that publish projects */}
              {hasProjects && (
                <div className="inline-grid grid-cols-2 gap-1 bg-white rounded-xl p-1 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                  {(['all', 'projects'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      aria-pressed={filterParam === value}
                      className={toggleClass(filterParam === value)}
                    >
                      {value === 'all' ? 'All posts' : 'Projects'}
                    </button>
                  ))}
                </div>
              )}

              {/* Sort — a visible toggle, since it's how readers find popular posts here */}
              <div
                role="group"
                aria-label="Sort posts"
                className="inline-grid grid-cols-2 gap-1 bg-white rounded-xl p-1 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
              >
                {(['latest', 'popular'] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setSortBy(value)}
                    aria-pressed={sortBy === value}
                    className={toggleClass(sortBy === value)}
                  >
                    {value === 'latest' ? 'Latest' : 'Popular'}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Tag Filter */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                aria-expanded={showTagDropdown}
                aria-haspopup="menu"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl font-medium text-sm text-zinc-700 hover:bg-zinc-50 transition-colors whitespace-nowrap dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Filter size={16} />
                {overflowTagCount > 0 ? 'More tags' : 'Tags'}
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
                    className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto dark:bg-zinc-900 dark:border-zinc-800"
                  >
                    <button
                      role="menuitem"
                      onClick={() => setTag('')}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                        !tagParam
                          ? 'bg-primary text-white'
                          : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      All Tags
                    </button>
                    {tags.map((t) => (
                      <button
                        key={t}
                        role="menuitem"
                        onClick={() => setTag(t)}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-t border-zinc-100 dark:border-zinc-800 ${
                          tagParam === t
                            ? 'bg-primary text-white'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
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

          {/* Visible top-tags shortcut — the "More tags" dropdown above still
              holds the full list; this row surfaces the common ones directly
              so readers don't need to open a menu to filter by them. */}
          {popularTagNames.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTag('')}
                className={
                  !tagParam
                    ? 'px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-primary text-white'
                    : 'px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-primary dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700'
                }
              >
                All Tags
              </button>
              {popularTagNames.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(tagParam === t ? '' : t)}
                  aria-pressed={tagParam === t}
                  className={
                    tagParam === t
                      ? 'px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-primary text-white'
                      : 'px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-primary dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700'
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Active filters — named, each removable on its own */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {tagParam && (
                <button
                  onClick={() => setTag('')}
                  aria-label={`Remove tag filter ${tagParam}`}
                  className={activeFilterChipClass}
                >
                  Tag: {tagParam} <X size={14} aria-hidden="true" />
                </button>
              )}
              {filterParam === 'projects' && (
                <button
                  onClick={() => setFilter('all')}
                  aria-label="Remove projects filter"
                  className={activeFilterChipClass}
                >
                  Projects only <X size={14} aria-hidden="true" />
                </button>
              )}
              {tagParam && filterParam === 'projects' && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-zinc-600 hover:text-zinc-900 font-medium underline transition-colors dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Posts List */}
        <div>
          {filteredPosts && filteredPosts.length > 0 ? (
            <div className={`transition-opacity ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
              {/* Year headings only make sense when the list is in date order. */}
              <PostList
                posts={filteredPosts}
                layout={archiveLayout}
                headingAs="h2"
                columns={3}
                groupByYear={sortBy === 'latest'}
              />
            </div>
          ) : (
            <>
              {/* Enhanced Empty State */}
              <div className="card p-8 sm:p-16 text-center">
                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6 dark:bg-zinc-800">
                  {tagParam ? (
                    <Search className="text-zinc-400" size={32} />
                  ) : (
                    <Inbox className="text-zinc-400" size={32} />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                  No posts found
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
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
                    className="btn-primary"
                  >
                    <X size={18} />
                    Clear all filters
                  </button>
                )}
              </div>
            </>
          )}

          {/* Pagination — only when there's more than one page */}
          {filteredPosts.length > 0 && totalPages > 1 && (
            <div className="mt-12 flex flex-col items-center gap-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogList;
