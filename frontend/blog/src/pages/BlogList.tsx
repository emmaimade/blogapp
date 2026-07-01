import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { X, Search, Filter, ChevronDown, TrendingUp, Clock } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { Sidebar } from '../components/Sidebar';
// import { formatLocalDate } from '../utils/dates';

type PostTag = {
  name: string;
};

type Post = {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  views?: number;
  thumbnail_url: string;
  is_project?: boolean;
  tags: PostTag[];
};

export const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const filterParam = searchParams.get('filter') || 'all';
  const tagParam = searchParams.get('tag') || '';

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: async () => (await api.get('/posts/')).data
  });

  // Extract unique tags
  const tags = useMemo(() => {
    const set = new Set<string>();
    posts?.forEach((post) => post.tags?.forEach((tag) => set.add(tag.name)));
    return Array.from(set).sort();
  }, [posts]);

  const popularPosts = useMemo(() => {
    return [...(posts || [])]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
  }, [posts]);

  // Filter posts
  let filteredPosts = useMemo(() => {
    if (!posts) return [];
    let items = posts;
    if (filterParam === 'projects') items = items.filter((post) => post.is_project);
    if (tagParam) items = items.filter((post) => post.tags?.some((tag) => tag.name === tagParam));
    
    // Sort posts
    if (sortBy === 'popular') {
      items = [...items].sort((a, b) => (b.views || 0) - (a.views || 0));
    } else {
      items = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return items;
  }, [posts, filterParam, tagParam, sortBy]);

  const setFilter = (f: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('filter', f);
    setSearchParams(next);
  };

  const setTag = (t: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!t) next.delete('tag'); 
    else next.set('tag', t);
    setSearchParams(next);
    setShowTagDropdown(false);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSortBy('latest');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <TrendingUp className="text-zinc-900" size={24} />
          </div>
          <p className="text-zinc-400 font-medium">Loading articles...</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = filterParam !== 'all' || tagParam;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      
      {/* Compact Header Section */}
      <div className="border-b border-zinc-200 bg-white sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">
                {filterParam === 'projects' ? 'Projects' : 'Articles'}
              </h1>
              <p className="text-sm text-zinc-600 mt-1">
                {filteredPosts.length} {filteredPosts.length === 1 ? 'item' : 'items'} {tagParam && `tagged "${tagParam}"`}
              </p>
            </div>
          </div>
        </div>
      </div>

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
                      ? 'px-4 py-2 rounded-md font-bold text-sm transition-all bg-purple-600 text-white'
                      : 'px-4 py-2 rounded-md font-bold text-sm transition-all text-zinc-600 hover:bg-zinc-50'
                  }
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('projects')}
                  className={
                    filterParam === 'projects'
                      ? 'px-4 py-2 rounded-md font-bold text-sm transition-all bg-purple-600 text-white'
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
                className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg font-medium text-sm text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm whitespace-nowrap"
              >
                <Filter size={16} />
                Tags
                {tagParam && <span className="w-2 h-2 bg-purple-600 rounded-full"></span>}
                <ChevronDown size={16} className={`transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Tag Dropdown Menu */}
              {showTagDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => setTag('')}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      !tagParam
                        ? 'bg-purple-600 text-white'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    All Tags
                  </button>
                  {tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTag(t)}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-t border-zinc-100 ${
                        tagParam === t
                          ? 'bg-purple-600 text-white'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Filters Indicator */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200">
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
              <div className="space-y-8">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <>
                {/* Enhanced Empty State */}
                <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-16 text-center shadow-sm">
                  <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="text-zinc-400" size={32} />
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
                      className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-900/10"
                    >
                      <X size={18} />
                      Clear All Filters
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Load More */}
            {filteredPosts.length >= 10 && (
              <div className="mt-12 flex justify-center">
                <button className="px-8 py-3 bg-white border-2 border-zinc-200 text-zinc-700 rounded-xl font-bold hover:border-zinc-300 hover:text-primary hover:shadow-md transition-all">
                  Load More Posts
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-8">
              <Sidebar popularPosts={popularPosts} tags={tags} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogList;