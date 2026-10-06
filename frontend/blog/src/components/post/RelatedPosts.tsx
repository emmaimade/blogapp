import React from 'react';
import { PostCard } from '../PostCard';
import type { Post } from '../../types/post';

interface RelatedPostsProps {
  posts: Post[];
  title?: string;
  subtitle?: string;
}

export const RelatedPosts: React.FC<RelatedPostsProps> = ({
  posts,
  title = 'Related Posts',
  subtitle = 'More stories in a similar vein.',
}) => {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 mb-6">{subtitle}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} variant="card" headingAs="h3" />
        ))}
      </div>
    </section>
  );
};
