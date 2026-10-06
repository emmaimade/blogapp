import React from 'react';
import { PostCard, type PostCardVariant } from './PostCard';
import { CompactRowSkeleton, FeedItemSkeleton, GridCardSkeleton, ListRowSkeleton } from './Skeletons';
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
  /** Cards per row on wide screens: 4 on the full-width home page, 3 on `/blog`. */
  columns?: 3 | 4;
  /** List and compact: group rows under year headings when they span more than one year. */
  groupByYear?: boolean;
}

const nextHeadingLevel: Record<HeadingLevel, HeadingLevel> = { h2: 'h3', h3: 'h4', h4: 'h4' };

const rowVariants: Record<Exclude<PostLayout, 'cards'>, PostCardVariant> = {
  feed: 'feed',
  list: 'list',
  compact: 'compact',
};

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

// Cards sit in a flex row of fixed widths from `lg` up, so a short last row
// is centred instead of leaving a gap on the right. Each card's wrapper is a
// one-cell grid so cards in a row share one height. The widths subtract the
// gaps (gap-5 = 1.25rem): two gaps for thirds, three for quarters.
const cardGridClass = 'grid gap-5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-center';
const cardCellClass: Record<3 | 4, string> = {
  3: 'grid lg:w-[calc((100%-2.5rem)/3)]',
  4: 'grid lg:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3.75rem)/4)]',
};

/** Renders a list of posts in the blog's chosen layout: feed, list, compact rows, or a card grid. */
export const PostList: React.FC<PostListProps> = ({
  posts,
  layout,
  headingAs = 'h2',
  columns = 4,
  groupByYear = false,
}) => {
  if (layout === 'cards') {
    return (
      <div className={cardGridClass}>
        {posts.map((post) => (
          <div key={post.id} className={cardCellClass[columns]}>
            <PostCard post={post} variant="card" headingAs={headingAs} />
          </div>
        ))}
      </div>
    );
  }

  const variant = rowVariants[layout];
  const canGroup = groupByYear && (layout === 'list' || layout === 'compact');
  const groups = canGroup ? groupPostsByYear(posts) : [];

  if (groups.length > 1) {
    const YearHeading = headingAs;
    return (
      <div className="space-y-10">
        {groups.map(({ year, posts: yearPosts }) => (
          <section key={year}>
            <YearHeading className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{year}</YearHeading>
            <div className={rowListClass}>
              {yearPosts.map((post) => (
                <PostCard key={post.id} post={post} variant={variant} headingAs={nextHeadingLevel[headingAs]} hideYear />
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
        <PostCard key={post.id} post={post} variant={variant} headingAs={headingAs} />
      ))}
    </div>
  );
};

const rowSkeletons: Record<Exclude<PostLayout, 'cards'>, React.FC> = {
  feed: FeedItemSkeleton,
  list: ListRowSkeleton,
  compact: CompactRowSkeleton,
};

/** Loading placeholder shaped like the chosen layout. */
export const PostListSkeleton: React.FC<{ layout: PostLayout; count: number; columns?: 3 | 4 }> = ({
  layout,
  count,
  columns = 4,
}) => {
  const items = Array.from({ length: count });
  if (layout === 'cards') {
    return (
      <div className={cardGridClass}>
        {items.map((_, i) => (
          <div key={i} className={cardCellClass[columns]}>
            <GridCardSkeleton />
          </div>
        ))}
      </div>
    );
  }
  const Row = rowSkeletons[layout];
  return (
    <div className={rowListClass}>
      {items.map((_, i) => <Row key={i} />)}
    </div>
  );
};
