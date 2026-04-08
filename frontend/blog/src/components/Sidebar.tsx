import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Tag, Eye } from 'lucide-react';

interface SidebarProps {
  popularPosts: Array<{
    id: number;
    slug: string;
    title: string;
    created_at: string;
    views?: number;
  }>;
  tags?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  popularPosts, 
  tags = []
}) => {
  return (
    <aside className="space-y-10 sticky top-24">
      
      {/* 1. Popular Posts Widget */}
      {popularPosts && popularPosts.length > 0 && (
        <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" /> Popular Posts
          </h3>
          <div className="space-y-6">
            {popularPosts.slice(0, 5).map((post, index) => (
              <Link 
                key={post.id} 
                to={`/post/${post.slug}`} 
                className="flex gap-3 sm:gap-4 group"
              >
                <span className="text-2xl font-black text-slate-100 group-hover:text-indigo-100 transition-colors">
                  {index + 1}
                </span>
                <div>
                  <h4 className="text-sm font-bold leading-snug group-hover:text-indigo-600 transition-colors">
                    {post.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-[10px] uppercase text-slate-400">
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye size={11} />
                      {(post.views || 0).toLocaleString()} views
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 2. Tags Cloud Widget */}
      {tags.length > 0 && (
        <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Tag size={18} className="text-indigo-600" /> Popular Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 10).map((tag) => (
              <Link
                key={tag}
                to={`/tag/${tag}`}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 rounded-full font-medium transition-all"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
