import React from 'react';
import { PostCard } from './PostCard';
import { CompactRowSkeleton, FeedItemSkeleton, GridCardSkeleton } from './Skeletons';
import { getPostDate } from '../utils/posts';
import type { PostLayout } from '../hooks/useSiteSettings';
import type { Post } from '../types/post';

type HeadingLevel = 'h2' | 'h3' | 'h4';

interface PostListProps {
  posts: Post[];
  /** The blog owner's choice from Appearance settings. */
  layout: PostLayout;
  /** Heading level for each post's title, to fit the page's outline. */
  headingAs?: HeadingLevel;
  /** Cards per row on desktop: 3 on the full-width home page, 2 inside `/blog`'s column. */
  columns?: 2 | 3;
  /** Compact only: group rows under year headings when they span more than one year. */
  groupByYear?: boolean;
}

const nextHeadingLevel: Record<HeadingLevel, HeadingLevel> = { h2: 'h3', h3: 'h4', h4: 'h4' };

const groupPostsByYear = (posts: Post[]) => {
  const groups: Array<{ year: number; posts: Post[] }> = [];
  for (const post of posts) {
    const year = new Date(getPostDate(post)).getFullYear();
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.posts.push(post);
    else groups.push({ year, posts: [post] });
  }
  return groups;
};

const rowListClass = 'divide-y divide-zinc-200 dark:divide-zinc-800';

/** Renders a list of posts in the blog's chosen layout: feed, compact rows, or a card grid. */
export const PostList: React.FC<PostListProps> = ({
  posts,
  layout,
  headingAs = 'h2',
  columns = 3,
  groupByYear = false,
}) => {
  if (layout === 'cards') {
    if (columns === 2) {
      return (
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} variant="card" headingAs={headingAs} />
          ))}
        </div>
      );
    }
    // On desktop, a flex row of fixed thirds, so a short last row sits in
    // the middle instead of leaving a gap on the right. Each card's wrapper
    // is a one-cell grid so cards in a row share one height.
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:flex lg:flex-wrap lg:justify-center">
        {posts.map((post) => (
          <div key={post.id} className="grid lg:w-[calc((100%-3rem)/3)]">
            <PostCard post={post} variant="card" headingAs={headingAs} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'compact') {
    const groups = groupByYear ? groupPostsByYear(posts) : [];
    if (groups.length > 1) {
      const YearHeading = headingAs;
      return (
        <div className="space-y-10">
          {groups.map(({ year, posts: yearPosts }) => (
            <section key={year}>
              <YearHeading className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{year}</YearHeading>
              <div className={rowListClass}>
                {yearPosts.map((post) => (
                  <PostCard key={post.id} post={post} variant="compact" headingAs={nextHeadingLevel[headingAs]} hideYear />
                ))}
              </div>
            </section>
          ))}
        </div>
      );
    }

    return (
      <div className={rowListClass}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} variant="compact" headingAs={headingAs} />
        ))}
      </div>
    );
  }

  return (
    <div className={rowListClass}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} variant="feed" headingAs={headingAs} />
      ))}
    </div>
  );
};

/** Loading placeholder shaped like the chosen layout. */
export const PostListSkeleton: React.FC<{ layout: PostLayout; count: number; columns?: 2 | 3 }> = ({
  layout,
  count,
  columns = 3,
}) => {
  const items = Array.from({ length: count });
  if (layout === 'cards') {
    return (
      <div className={columns === 2 ? 'grid gap-6 sm:grid-cols-2' : 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'}>
        {items.map((_, i) => <GridCardSkeleton key={i} />)}
      </div>
    );
  }
  const Row = layout === 'compact' ? CompactRowSkeleton : FeedItemSkeleton;
  return (
    <div className={rowListClass}>
      {items.map((_, i) => <Row key={i} />)}
    </div>
  );
};
