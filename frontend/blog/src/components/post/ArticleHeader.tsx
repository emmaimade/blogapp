import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Eye, RefreshCw } from 'lucide-react';
import { formatLocalDate } from '../../utils/dates';
import { getEditedDate, getPostDate, shouldShowViews, tagUrl } from '../../utils/posts';
import type { PostDetail } from '../../types/post';
import { ShareButtons } from './ShareButtons';

const getAuthorName = (author: PostDetail['author']) =>
  [author?.first_name, author?.last_name].filter(Boolean).join(' ') || author?.username || 'Unknown author';

export const ArticleHeader: React.FC<{ post: PostDetail }> = ({ post }) => {
  const authorName = getAuthorName(post.author);
  const editedAt = getEditedDate(post, formatLocalDate);

  return (
    <header className="mb-10">
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <Link
              key={tag.id ?? tag.name}
              to={tagUrl(tag.name)}
              className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-semibold hover:bg-primary hover:text-white transition-colors dark:bg-primary/25 dark:text-zinc-100 dark:hover:bg-primary"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight mb-6 break-words">
        {post.title}
      </h1>

      {/* Author & Date */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-zinc-500 dark:text-zinc-400 border-y border-zinc-100 dark:border-zinc-800 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-bold" aria-hidden="true">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{authorName}</span>
            {post.author?.role && (
              <span className="ml-2 text-xs uppercase tracking-wider bg-zinc-100 text-zinc-500 px-2 py-px rounded dark:bg-zinc-800 dark:text-zinc-400">
                {post.author.role}
              </span>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1 text-sm">
          <Calendar size={14} /> {formatLocalDate(getPostDate(post))}
        </span>
        {editedAt && (
          <span className="flex items-center gap-1 text-sm">
            <RefreshCw size={14} /> Updated {formatLocalDate(editedAt)}
          </span>
        )}
        {shouldShowViews(post.views) && (
          <span className="flex items-center gap-1 text-sm">
            <Eye size={14} /> {post.views.toLocaleString()} views
          </span>
        )}
      </div>

      <div className="mt-4">
        <ShareButtons title={post.title} />
      </div>
    </header>
  );
};
