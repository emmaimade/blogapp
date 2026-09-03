import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, User } from 'lucide-react';
import { formatLocalDate } from '../utils/dates';
import { getReadingTime, getPlainExcerpt } from '../utils/posts';
import { getThumbnailUrl, handleThumbnailError } from '../utils/images';
import type { Post } from '../types/post';

interface PostProps {
  post: Post;
}

const getAuthorName = (author: Post['author']) => {
  const fullName = [author?.first_name, author?.last_name].filter(Boolean).join(' ');
  return fullName || author?.username || 'Anonymous';
};

export const PostCard: React.FC<PostProps> = ({ post }) => {
  const visibleTags = post.tags.slice(0, 3);
  const remainingTags = Math.max(post.tags.length - visibleTags.length, 0);
  const excerpt = post.excerpt || getPlainExcerpt(post.content, 140);

  return (
    <article className="flex flex-col md:flex-row gap-4 sm:gap-6 mb-10 group">
      {/* Image Container */}
      <div className="md:w-1/3 overflow-hidden rounded-2xl aspect-[4/3]">
        <Link to={`/post/${post.slug}`}>
          <img
            src={getThumbnailUrl(post.thumbnail_url, 500)}
            onError={handleThumbnailError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            alt={post.title}
            loading="lazy"
            decoding="async"
          />
        </Link>
      </div>

      {/* Content */}
      <div className="md:w-2/3 flex flex-col justify-center min-w-0">
        <div className="flex flex-wrap gap-2 mb-3">
          {visibleTags.map(tag => (
            <span key={tag.name} className="bg-zinc-50 text-zinc-900 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
              {tag.name}
            </span>
          ))}
          {remainingTags > 0 && (
            <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
              +{remainingTags} more
            </span>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2 group-hover:text-primary transition-colors break-words">
          <Link to={`/post/${post.slug}`}>{post.title}</Link>
        </h2>
        {excerpt && (
          <p className="text-sm text-zinc-600 mb-3 line-clamp-2 leading-relaxed">
            {excerpt}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-zinc-500 text-sm">
          <span className="flex items-center gap-1"><User size={14}/> {getAuthorName(post.author)}</span>
          <span className="flex items-center gap-1"><Calendar size={14}/> {formatLocalDate(post.created_at)}</span>
          <span className="flex items-center gap-1"><Clock size={14}/> {getReadingTime(post.content)} min read</span>
        </div>
      </div>
    </article>
  );
};
