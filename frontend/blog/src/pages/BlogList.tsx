import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { X, Search, Filter, Sparkles } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { Sidebar } from '../components/Sidebar';

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
  const [showFilters, setShowFilters] = useState(false);
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
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    let items = posts;
    if (filterParam === 'projects') items = items.filter((post) => post.is_project);
    if (tagParam) items = items.filter((post) => post.tags?.some((tag) => tag.name === tagParam));
    return items;
  }, [posts, filterParam, tagParam]);

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
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="text-zinc-900" size={24} />
          </div>
          <p className="text-zinc-400 font-medium">Loading articles...</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = filterParam !== 'all' || tagParam;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      
      {/* Hero Section - ✅ GENERIC (no niche-specific text) */}
      <div className="bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-50 border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full mb-6 border border-zinc-300">
              <Sparkles className="text-zinc-900" size={16} />
              <span className="text-sm font-bold text-zinc-900">
                {filteredPosts.length} {filteredPosts.length === 1 ? 'Article' : 'Articles'}
              </span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 mb-4">
              {filterParam === 'projects' ? 'Projects & Case Studies' : 'All Articles'}
            </h1>
            
            {/* ✅ Generic description - works for ANY niche */}
            <p className="text-lg text-zinc-600">
              {filterParam === 'projects' 
                ? 'Explore featured projects, case studies, and technical deep-dives'
                : tagParam 
                  ? `Browse all articles tagged with "${tagParam}"`
                  : 'Discover our latest articles, stories, and insights'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Compact Filter Bar */}
        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-white rounded-xl p-1.5 border border-zinc-200 shadow-sm w-full md:w-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
 filterParam === 'all' 
 ? 'bg-primary text-white shadow-sm' 
 : 'text-zinc-600 hover:bg-zinc-50'
 }`}
              >
                All Posts
              </button>
              <button
                onClick={() => setFilter('projects')}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
 filterParam === 'projects' 
 ? 'bg-primary text-white shadow-sm' 
 : 'text-zinc-600 hover:bg-zinc-50'
 }`}
              >
                Projects
              </button>
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl font-medium text-sm text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm w-full md:w-auto"
            >
              <Filter size={16} />
              Filter by Tag
              {tagParam && (
                <span className="w-2 h-2 bg-zinc-900 rounded-full"></span>
              )}
            </button>
          </div>

          {/* Expandable Tags Section */}
          {showFilters && tags.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="font-bold text-zinc-900">Filter by Tag</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTag('')}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
 !tagParam 
 ? 'bg-primary text-white shadow-sm' 
 : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
 }`}
                >
                  All Tags
                </button>
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
 tagParam === t 
 ? 'bg-primary text-white shadow-sm' 
 : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
 }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Filter Indicator */}
          {tagParam && (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center mb-6">
              <div className="inline-flex items-center gap-2 bg-zinc-50 text-zinc-950 px-4 py-2 rounded-xl text-sm font-medium border border-zinc-300">
                <span>Showing: <strong>{tagParam}</strong></span>
                <button
                  onClick={() => setTag('')}
                  className="hover:bg-zinc-100 p-1 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors underline"
              >
                Clear all filters
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
