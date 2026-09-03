import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Eye, TrendingUp } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { Sidebar } from '../components/Sidebar';
import { PageLoader } from '../components/PageLoader';
import { formatLocalDate } from '../utils/dates';
import { getReadingTime, getPlainExcerpt } from '../utils/posts';
import { getThumbnailUrl, handleThumbnailError } from '../utils/images';
import type { PaginatedPosts } from '../types/post';

// The homepage is a bounded teaser (featured + trending + a handful of
// recent posts), not the full archive — /blog is the real paginated listing.
const HOME_POST_LIMIT = 20;

export const Home: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'projects'>('all');

  const { data, isLoading } = useQuery<PaginatedPosts>({
    queryKey: ['posts', 'home'],
    queryFn: async () => {
      const res = await api.get('/posts/', { params: { limit: HOME_POST_LIMIT, sort: 'latest' } });
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  // Exclude sample/welcome posts from all public display.
  // They exist to show owners the dashboard has content — readers shouldn't see them.
  const displayPosts = React.useMemo(
    () => (data?.items ?? []).filter((p) => !p.is_sample),
    [data]
  );

  const tags = React.useMemo(() => {
    const set = new Set<string>();
    displayPosts.forEach((p: any) => p.tags?.forEach((t: any) => set.add(t.name)));
    return Array.from(set).sort();
  }, [displayPosts]);

  const popularPosts = React.useMemo(() => {
    return [...displayPosts]
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
  }, [displayPosts]);

  const getVisibleTags = (post: any, limit: number) => post.tags?.slice(0, limit) || [];
  const getRemainingTagCount = (post: any, limit: number) => Math.max((post.tags?.length || 0) - limit, 0);

  const filteredPosts = filter === 'projects'
    ? displayPosts.filter((p: any) => p.is_project)
    : displayPosts;

  const featuredPost = filteredPosts?.[0];
  const trendingPosts = filteredPosts?.slice(1, 5) || [];
  const regularPosts = filteredPosts?.slice(5) || [];

  // The featured-post hero (rendered only when featuredPost exists) carries
  // the page's <h1>. Without it, this section heading needs to be the <h1>
  // instead, so the page always has exactly one.
  const SectionHeading = featuredPost ? 'h2' : 'h1';

  if (isLoading) {
    return <PageLoader label="Loading stories" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      {featuredPost && (
        <div className="bg-gradient-to-b from-zinc-50 to-white border-b border-zinc-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <Link to={`/post/${featuredPost.slug}`} className="block group">
              <article className="bg-white rounded-3xl overflow-hidden border border-zinc-200 shadow-lg hover:shadow-2xl transition-all duration-500">
                <div className="relative overflow-hidden h-[440px] sm:h-[500px] md:h-[600px]">
                  <img
                    src={getThumbnailUrl(featuredPost.thumbnail_url, 1200)}
                    onError={handleThumbnailError}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

                  <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
                    <span className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 bg-white/95 backdrop-blur-sm rounded-full text-xs sm:text-sm font-bold text-zinc-900 shadow-lg">
                      Featured Story
                    </span>
                  </div>

                  <div className="absolute top-16 left-4 right-4 sm:top-8 sm:left-auto sm:right-8 flex flex-wrap justify-start sm:justify-end gap-2">
                    {getVisibleTags(featuredPost, 3).map((tag: any) => (
                      <span
                        key={tag.id}
                        className="px-3 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs sm:text-sm font-bold rounded-full border border-white/30"
                      >
                        {tag.name}
                      </span>
                    ))}
                    {getRemainingTagCount(featuredPost, 3) > 0 && (
                      <span className="px-3 py-1.5 bg-black/25 backdrop-blur-md text-white text-xs sm:text-sm font-bold rounded-full border border-white/20">
                        +{getRemainingTagCount(featuredPost, 3)} more
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-12">
                    <div className="max-w-4xl">
                      <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight group-hover:text-zinc-500 transition-colors">
                        {featuredPost.title}
                      </h1>

                      <p className="text-white/95 text-sm sm:text-lg md:text-xl mb-5 sm:mb-6 line-clamp-3 sm:line-clamp-2 leading-relaxed">
                        {getPlainExcerpt(featuredPost.content, 160)}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm md:text-base text-white/90">
                        <div className="flex items-center gap-2">
                          <Clock size={18} className="text-white/80" />
                          <span className="font-medium">
                            {getReadingTime(featuredPost.content)} min
                            read
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye size={18} className="text-white/80" />
                          <span className="font-medium">
                            {featuredPost.views || 0} views
                          </span>
                        </div>
                        <span className="text-white/70">&bull;</span>
                        <span className="font-medium">
                          {formatLocalDate(featuredPost.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <SectionHeading className="text-2xl md:text-3xl font-black text-zinc-900">
              {filter === "all" ? "Latest Articles" : "Featured Projects"}
            </SectionHeading>
            <p className="text-zinc-600 mt-1">
              {filteredPosts?.length || 0}{" "}
              {filter === "all" ? "posts" : "projects"} &bull; Updated daily
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-white rounded-xl p-1.5 border border-zinc-200 shadow-sm w-full md:w-auto">
            <button
              onClick={() => setFilter("all")}
              className={
                filter === "all"
                  ? "px-4 py-2 rounded-lg font-bold text-sm transition-all bg-primary text-white shadow-sm"
                  : "px-4 py-2 rounded-lg font-bold text-sm transition-all text-zinc-600 hover:text-primary hover:bg-zinc-50"
              }
            >
              All Posts
            </button>
            <button
              onClick={() => setFilter("projects")}
              className={
                filter === "projects"
                  ? "px-4 py-2 rounded-lg font-bold text-sm transition-all bg-primary text-white shadow-sm"
                  : "px-4 py-2 rounded-lg font-bold text-sm transition-all text-zinc-600 hover:text-primary hover:bg-zinc-50"
              }
            >
              Projects
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-8 space-y-12">
            {trendingPosts.length > 0 && (
              <div>
                <h3 className="text-xl font-black text-zinc-900 mb-6 flex items-center gap-2">
                  <TrendingUp size={22} className="text-zinc-900" />
                  Trending Now
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  {trendingPosts.map((post: any) => (
                    <Link
                      key={post.id}
                      to={`/post/${post.slug}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:shadow-xl hover:border-zinc-200 transition-all duration-300"
                    >
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={getThumbnailUrl(post.thumbnail_url, 500)}
                          onError={handleThumbnailError}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                      </div>

                      <div className="p-5">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {getVisibleTags(post, 2).map((tag: any) => (
                            <span
                              key={tag.id}
                              className="text-xs px-2.5 py-1 bg-zinc-50 text-zinc-900 rounded-full font-bold"
                            >
                              {tag.name}
                            </span>
                          ))}
                          {getRemainingTagCount(post, 2) > 0 && (
                            <span className="text-xs px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full font-bold">
                              +{getRemainingTagCount(post, 2)} more
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-zinc-900 mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {post.title}
                        </h3>

                        <p className="text-sm text-zinc-600 mb-4 line-clamp-2 leading-relaxed">
                          {getPlainExcerpt(post.content, 100)}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Clock size={14} />
                            {getReadingTime(post.content)} min
                          </span>
                          <span>&bull;</span>
                          <span>
                            {formatLocalDate(post.created_at)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {regularPosts.length > 0 && (
              <div>
                <h3 className="text-xl font-black text-zinc-900 mb-6">
                  More Articles
                </h3>
                <div className="space-y-6">
                  {regularPosts.map((post: any) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            )}

            {filteredPosts?.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-zinc-200">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="text-zinc-400" size={28} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">
                  {filter === 'all' ? 'No posts yet' : 'No projects yet'}
                </h3>
                <p className="text-zinc-600">
                  Check back soon for new content!
                </p>
              </div>
            )}

            {regularPosts.length >= 8 && (
              <div className="flex justify-center pt-6">
                <Link
                  to="/blog"
                  className="px-8 py-3 bg-white border-2 border-zinc-200 text-zinc-700 rounded-xl font-bold hover:border-zinc-300 hover:text-primary hover:shadow-md transition-all"
                >
                  Load More Posts
                </Link>
              </div>
            )}
          </div>

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