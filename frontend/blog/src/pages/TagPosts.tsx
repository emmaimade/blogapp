import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tag as TagIcon, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';
import { PageLoader } from '../components/PageLoader';
import { Sidebar } from '../components/Sidebar';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts';
import type { PaginatedPosts } from '../types/post';

export const TagPosts: React.FC = () => {
  const { tag } = useParams<{ tag: string }>();

  const {
    posts,
    total,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedPosts(['tagPosts', tag], '/posts/search', { tag }, !!tag);

  // Sidebar content mirrors BlogList — independent of the tag filter above,
  // so it always reflects the whole blog rather than just this tag's posts.
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/tags/')).data,
    staleTime: 5 * 60 * 1000,
  });
  const allTags = useMemo(
    () => Array.from(new Set((tagsData || []).map((t: { name: string }) => t.name))).sort() as string[],
    [tagsData],
  );

  const { data: popularData } = useQuery<PaginatedPosts>({
    queryKey: ['posts', 'sidebar-popular'],
    queryFn: async () => (await api.get('/posts/', { params: { sort: 'popular', limit: 5 } })).data,
    staleTime: 5 * 60 * 1000,
  });
  const popularPosts = popularData?.items ?? [];

  if (isLoading) {
    return <PageLoader label="Loading posts" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">

      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-zinc-600 hover:text-primary mb-8 font-medium transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Home
      </Link>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center">
            <TagIcon className="text-white" size={24} />
          </div>
          <h1 className="text-4xl font-black text-zinc-900">
            #{tag}
          </h1>
        </div>
        <p className="text-zinc-600">
          {total} {total === 1 ? 'post' : 'posts'} tagged with <span className="font-bold text-zinc-900">#{tag}</span>
        </p>
      </div>

      {/* Posts + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8">
          {posts.length > 0 ? (
            <>
              <div className="space-y-8">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
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
                    Load More Posts
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <TagIcon className="mx-auto mb-4 text-zinc-300" size={64} />
              <p className="text-zinc-500 font-medium text-lg mb-2">
                No posts found with tag "#{tag}"
              </p>
              <Link
                to="/"
                className="text-zinc-900 hover:text-zinc-950 font-bold"
              >
                Explore all posts →
              </Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <Sidebar popularPosts={popularPosts} tags={allTags} />
          </div>
        </div>
      </div>
    </div>
  );
};