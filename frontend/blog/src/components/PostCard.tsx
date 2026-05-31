import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

interface PostProps {
  post: {
    id: number;
    title: string;
    slug: string;
    thumbnail_url: string;
    created_at: string;
    tags: { name: string }[];
  };
}

export const PostCard: React.FC<PostProps> = ({ post }) => {
  const visibleTags = post.tags.slice(0, 3);
  const remainingTags = Math.max(post.tags.length - visibleTags.length, 0);

  return (
    <article className="flex flex-col md:flex-row gap-4 sm:gap-6 mb-10 group">
      {/* Image Container */}
      <div className="md:w-1/3 overflow-hidden rounded-2xl aspect-[4/3]">
        <Link to={`/post/${post.slug}`}>
          <img 
            src={post.thumbnail_url || '/placeholder.jpg'} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            alt={post.title}
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
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-3 group-hover:text-primary transition-colors break-words">
          <Link to={`/post/${post.slug}`}>{post.title}</Link>
        </h2>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-zinc-500 text-sm">
          <span className="flex items-center gap-1"><User size={14}/> Admin</span>
          <span className="flex items-center gap-1"><Calendar size={14}/> {format(new Date(post.created_at), 'MMM dd, yyyy')}</span>
        </div>
      </div>
    </article>
  );
};
