import React from 'react';
import { Link } from 'react-router-dom';
import { formatLocalDate, formatShortDate } from '../utils/dates';
import { getPostDate, getPlainExcerpt, tagUrl } from '../utils/posts';
import { getThumbnailUrl, handleThumbnailError } from '../utils/images';
import type { Post } from '../types/post';

export type PostCardVariant = 'feed' | 'compact' | 'card';

interface PostProps {
  post: Post;
  /**
   * `feed` (default): title, excerpt and byline, with a thumbnail only when the post has one.
   * `compact`: a single text row — date, title, tags.
   * `card`: a small image-on-top grid card.
   */
  variant?: PostCardVariant;
  /** Match the surrounding page outline — a card under an <h2> section should be an <h3>. */
  headingAs?: 'h2' | 'h3' | 'h4';
  /** Compact rows under a year heading drop the year from their date. */
  hideYear?: boolean;
}

const getAuthorName = (author: Post['author']) => {
  const fullName = [author?.first_name, author?.last_name].filter(Boolean).join(' ');
  return fullName || author?.username || 'Anonymous';
};

// The grid card is one big link, so its tags can't be links themselves —
// they're plain text, deliberately not chip-shaped, so they don't look clickable.
const TagLabels: React.FC<{ post: Post; limit: number }> = ({ post, limit }) => {
  const visibleTags = post.tags.slice(0, limit);
  const remainingTags = Math.max(post.tags.length - limit, 0);
  if (visibleTags.length === 0) return null;

  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 line-clamp-1">
      {visibleTags.map((tag) => tag.name).join(' · ')}
      {remainingTags > 0 && ` · +${remainingTags}`}
    </p>
  );
};

export const PostCard: React.FC<PostProps> = ({ post, variant = 'feed', headingAs, hideYear = false }) => {
  const excerpt = post.excerpt || getPlainExcerpt(post.content, 160);
  const postDate = getPostDate(post);
  const Heading = headingAs ?? (variant === 'card' ? 'h3' : 'h2');

  if (variant === 'card') {
    return (
      <Link
        to={`/post/${post.slug}`}
        className="card group flex flex-col overflow-hidden transition hover:border-zinc-300 hover:shadow-lg dark:hover:border-zinc-700"
      >
        <div className="aspect-video overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img
            src={getThumbnailUrl(post.thumbnail_url, 400)}
            onError={handleThumbnailError}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="flex flex-1 flex-col p-4">
          <TagLabels post={post} limit={2} />
          <Heading className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50 transition-colors group-hover:text-primary line-clamp-2">
            {post.title}
          </Heading>
          <time dateTime={postDate} className="mt-auto pt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {formatLocalDate(postDate)}
          </time>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    const tagNames = post.tags.slice(0, 2).map((tag) => tag.name);
    return (
      <article className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
        <time
          dateTime={postDate}
          className="shrink-0 text-sm tabular-nums text-zinc-500 dark:text-zinc-400 sm:w-28"
        >
          {hideYear ? formatShortDate(postDate) : formatLocalDate(postDate)}
        </time>
        <Heading className="min-w-0 flex-1 text-base font-medium leading-snug text-zinc-900 dark:text-zinc-50">
          <Link to={`/post/${post.slug}`} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </Heading>
        {tagNames.length > 0 && (
          <span className="hidden shrink-0 text-xs text-zinc-500 dark:text-zinc-400 sm:block">
            {tagNames.map((name, i) => (
              <React.Fragment key={name}>
                {i > 0 && ' · '}
                <Link to={tagUrl(name)} className="hover:text-primary transition-colors">{name}</Link>
              </React.Fragment>
            ))}
          </span>
        )}
      </article>
    );
  }

  // Feed — the writing leads; an image only appears when the author added one.
  const firstTag = post.tags[0]?.name;
  return (
    <article className="flex gap-5 py-6 sm:gap-6">
      <div className="min-w-0 flex-1">
        <Heading className="text-xl sm:text-2xl font-semibold leading-snug text-zinc-900 dark:text-zinc-50 break-words">
          <Link to={`/post/${post.slug}`} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </Heading>
        {excerpt && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">{excerpt}</p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{getAuthorName(post.author)}</span>
          <span aria-hidden="true">&middot;</span>
          <time dateTime={postDate}>{formatLocalDate(postDate)}</time>
          {firstTag && (
            <>
              <span aria-hidden="true">&middot;</span>
              <Link to={tagUrl(firstTag)} className="hover:text-primary transition-colors">{firstTag}</Link>
            </>
          )}
        </p>
      </div>

      {post.thumbnail_url && (
        <Link
          to={`/post/${post.slug}`}
          tabIndex={-1}
          aria-hidden="true"
          className="h-20 w-20 shrink-0 self-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 sm:h-24 sm:w-24"
        >
          <img
            src={getThumbnailUrl(post.thumbnail_url, 200)}
            onError={handleThumbnailError}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </Link>
      )}
    </article>
  );
};
