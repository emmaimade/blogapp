import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tag as TagIcon, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../api/blogApi';
import { PostCard } from '../components/PostCard';

export const TagPosts: React.FC = () => {
  const { tag } = useParams<{ tag: string }>();

  const { data: posts, isLoading } = useQuery({
    queryKey: ['tagPosts', tag],
    queryFn: async () => {
      const res = await api.get('/posts/search', {
        params: { tag }
      });
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-zinc-900 mb-4" size={40} />
        <p className="text-zinc-400 font-medium">Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      
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
          {posts?.length || 0} {posts?.length === 1 ? 'post' : 'posts'} tagged with <span className="font-bold text-zinc-900">#{tag}</span>
        </p>
      </div>

      {/* Posts */}
      {posts && posts.length > 0 ? (
        <div className="space-y-8">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
          <TagIcon className="mx-auto mb-4 text-zinc-300" size={64} />
          <p className="text-zinc-400 font-medium text-lg mb-2">
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
  );
};