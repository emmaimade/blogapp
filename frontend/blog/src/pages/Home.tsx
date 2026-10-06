import React, { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, TrendingUp } from 'lucide-react';
import api from '../api/blogApi';
import { PostList, PostListSkeleton } from '../components/PostList';
import { HeroSkeleton } from '../components/Skeletons';
import { formatLocalDate } from '../utils/dates';
import { getPostDate, getPlainExcerpt, shouldShowViews } from '../utils/posts';
import { getThumbnailUrl, handleThumbnailError } from '../utils/images';
import { usePostLayouts, useSiteName, useSiteSettings } from '../hooks/useSiteSettings';
import { useSidebarData } from '../hooks/useSidebarData';
import { useBlogStats } from '../hooks/useBlogStats';
import { applyPageMeta } from '../utils/seo';
import type { PaginatedPosts, Post } from '../types/post';

// The homepage is a short teaser — one hero plus the next few posts in the
// owner's chosen layout — not the archive. /blog is the real paginated listing.
// Cards show 8 (two full rows of 4 on wide screens); the row layouts show 6.
const CARD_POST_COUNT = 8;
const ROW_POST_COUNT = 6;
// Always fetch enough for the largest layout, so switching layouts (or the
// settings arriving after the posts) never needs a second request.
const HOME_POST_LIMIT = CARD_POST_COUNT + 1;

// "Most read" only lists posts the page isn't already showing, and only when
// there are enough of them to fill its row. Fetching more popular posts than
// it shows leaves room for the ones the hero and grid already cover.
const MOST_READ_COUNT = 3;
const POPULAR_FETCH_LIMIT = 10;

export const Home: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'projects'>('all');

  // The homepage is the site's own identity, not "just another page" — it
  // keeps the brand-first title (and respects a tenant's custom SEO title
  // override verbatim) instead of the "{page} · {siteName}" pattern every
  // other page uses.
  const { data: siteSettings } = useSiteSettings();
  const siteName = useSiteName();
  React.useEffect(() => {
    const general = siteSettings?.general;
    const seo = siteSettings?.seo;
    const siteTagline = general?.site_tagline;

    // Same title rule as middleware.ts, so it doesn't change on hydration.
    applyPageMeta({
      title: seo?.meta_title || (siteTagline ? `${siteName} - ${siteTagline}` : siteName),
      description: seo?.meta_description || general?.site_description || '',
      ogImage: seo?.og_image,
    });
  }, [siteSettings, siteName]);

  const { homeLayout } = usePostLayouts();
  // Feed and compact read best as a single centred column; cards use the full width.
  const listWidthClass = homeLayout === 'cards' ? '' : 'max-w-3xl mx-auto';
  const gridPostCount = homeLayout === 'cards' ? CARD_POST_COUNT : ROW_POST_COUNT;

  // Blogs that never publish projects don't get an always-empty Projects tab.
  const { hasProjects } = useBlogStats();
  const activeFilter = hasProjects === false ? 'all' : filter;

  // The Projects toggle asks the server for projects, so it covers the whole
  // blog rather than filtering whichever posts were already loaded. The
  // server sorts the owner's featured post (if any) first.
  const { data, isLoading } = useQuery<PaginatedPosts>({
    queryKey: ['posts', 'home', activeFilter, HOME_POST_LIMIT],
    queryFn: async () => {
      const res = await api.get('/posts/', {
        params: {
          limit: HOME_POST_LIMIT,
          sort: 'latest',
          filter: activeFilter === 'projects' ? 'projects' : undefined,
        },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const { popularPosts } = useSidebarData(POPULAR_FETCH_LIMIT);

  const getVisibleTags = (post: Post, limit: number) => post.tags.slice(0, limit);
  const getRemainingTagCount = (post: Post, limit: number) => Math.max(post.tags.length - limit, 0);

  const posts = data?.items ?? [];
  const totalPosts = data?.total ?? 0;

  const shownPosts = posts.slice(0, gridPostCount + 1);
  const heroPost = shownPosts[0];
  const gridPosts = shownPosts.slice(1);
  const blogLink = activeFilter === 'projects' ? '/blog?filter=projects' : '/blog';

  const shownPostIds = new Set(shownPosts.map((post) => post.id));
  const mostReadPosts = popularPosts
    .filter((post) => !shownPostIds.has(post.id))
    .slice(0, MOST_READ_COUNT);
  const showMostRead = mostReadPosts.length === MOST_READ_COUNT;

  // The hero (rendered only when heroPost exists) carries the page's <h1>.
  // Without it, this section heading needs to be the <h1> instead, so the
  // page always has exactly one.
  const SectionHeading = heroPost ? 'h2' : 'h1';

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <HeroSkeleton />
        <div className={`mt-12 ${listWidthClass}`}>
          <PostListSkeleton layout={homeLayout} count={gridPostCount} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {heroPost && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          <Link to={`/post/${heroPost.slug}`} className="block group">
            <article className="relative overflow-hidden rounded-2xl h-[380px] sm:h-[420px] md:h-[480px] bg-zinc-900">
              <img
                src={getThumbnailUrl(heroPost.thumbnail_url, 1200)}
                onError={handleThumbnailError}
                alt=""
                fetchPriority="high"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 motion-reduce:transition-none"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

              <div className="absolute top-4 left-4 right-4 sm:top-8 sm:left-8 sm:right-8 flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 bg-white/95 rounded-full text-xs sm:text-sm font-bold text-zinc-900">
                  {heroPost.is_featured ? 'Featured' : 'Latest'}
                </span>
                {getVisibleTags(heroPost, 3).map((tag) => (
                  <span
                    key={tag.id ?? tag.name}
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs sm:text-sm font-semibold rounded-full border border-white/30"
                  >
                    {tag.name}
                  </span>
                ))}
                {getRemainingTagCount(heroPost, 3) > 0 && (
                  <span className="px-2 py-1.5 text-white/80 text-xs sm:text-sm font-semibold">
                    +{getRemainingTagCount(heroPost, 3)} more
                  </span>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-12">
                <div className="max-w-4xl">
                  <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-4 leading-tight underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-white/70 transition-[text-decoration-color]">
                    {heroPost.title}
                  </h1>

                  <p className="text-white/95 text-sm sm:text-lg mb-5 line-clamp-2 leading-relaxed">
                    {heroPost.excerpt || getPlainExcerpt(heroPost.content, 160)}
                  </p>

                  <p className="text-sm font-medium text-white/90">
                    {formatLocalDate(getPostDate(heroPost))}
                  </p>
                </div>
              </div>
            </article>
          </Link>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Latest posts */}
        <section>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:flex-col lg:items-center lg:justify-start lg:text-center">
            <SectionHeading className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {activeFilter === 'projects' ? 'Latest projects' : 'Latest posts'}
            </SectionHeading>

            {hasProjects && (
              <div className="inline-grid grid-cols-2 gap-1 self-start lg:self-center rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
                {(['all', 'projects'] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    aria-pressed={activeFilter === value}
                    className={
                      activeFilter === value
                        ? 'px-4 py-2 rounded-lg font-bold text-sm transition-colors bg-primary text-white'
                        : 'px-4 py-2 rounded-lg font-bold text-sm transition-colors text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
                    }
                  >
                    {value === 'all' ? 'All posts' : 'Projects'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {gridPosts.length > 0 && (
            <div className={listWidthClass}>
              <PostList posts={gridPosts} layout={homeLayout} headingAs="h3" />
            </div>
          )}

          {posts.length === 0 && (
            <div className="card text-center py-20 px-6">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-zinc-800">
                <TrendingUp className="text-zinc-400" size={28} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                {activeFilter === 'all' ? 'No posts yet' : 'No projects yet'}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Check back soon for new content.
              </p>
            </div>
          )}

          {totalPosts > shownPosts.length && (
            <div className="mt-10 flex justify-center">
              <Link to={blogLink} className="btn-secondary">
                View all posts <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>

        {/* Most read — popular posts not already on the page */}
        {showMostRead && (
          <section>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 lg:text-center">Most read</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {mostReadPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/post/${post.slug}`}
                  className="card group flex items-center gap-4 p-3 transition hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    <img
                      src={getThumbnailUrl(post.thumbnail_url, 200)}
                      onError={handleThumbnailError}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug text-zinc-900 line-clamp-2 group-hover:text-primary transition-colors dark:text-zinc-50">
                      {post.title}
                    </h3>
                    <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatLocalDate(getPostDate(post))}
                      {shouldShowViews(post.views) && (
                        <>
                          <span aria-hidden="true">&bull;</span>
                          <span className="inline-flex items-center gap-1">
                            <Eye size={12} aria-hidden="true" /> {post.views.toLocaleString()} views
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
