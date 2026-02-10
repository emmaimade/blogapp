import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ArrowLeft, Edit, Calendar, Tag as TagIcon } from 'lucide-react';
import 'highlight.js/styles/atom-one-dark.css';
import api from '../api/client';
import { type Post } from '../types';

export const PostView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: post, isLoading } = useQuery<Post>({
    queryKey: ['post', id],
    queryFn: async () => (await api.get(`/posts/${id}`)).data,
  });

  if (isLoading) return <div className="p-20 text-center animate-pulse">Loading post...</div>;
  if (!post) return <div className="p-20 text-center">Post not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Admin Header Actions */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <button 
          onClick={() => navigate('/admin/posts')}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft size={20} /> Back to List
        </button>
        <button 
          onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
          className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100 transition"
        >
          <Edit size={18} /> Edit Post
        </button>
      </div>

      {/* Post Metadata */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          {!post.published && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Draft</span>
          )}
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar size={14} /> {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{post.title}</h1>
        
        <div className="flex gap-2">
          {post.tags?.map(tag => (
            <span key={tag.id} className="text-sm text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1">
              <TagIcon size={12} /> {tag.name}
            </span>
          ))}
        </div>
      </header>

      {/* Rendered Content */}
      <article className="prose prose-indigo prose-lg max-w-none bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h1: ({ node, ...props }) => <h1 className="text-4xl font-bold mb-6 mt-8 text-gray-900" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-3xl font-bold mb-5 mt-7 text-gray-900" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mb-4 mt-6 text-gray-900" {...props} />,
            p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 text-gray-700 space-y-2" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 text-gray-700 space-y-2" {...props} />,
            li: ({ node, ...props }) => <li className="ml-4" {...props} />,
            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-gray-50 italic text-gray-700" {...props} />,
            code: ({ node, inline, ...props }) => 
              inline ? (
                <code className="bg-gray-200 px-2 py-1 rounded text-sm font-mono text-red-600" {...props} />
              ) : (
                <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4" {...props} />
              ),
            pre: ({ node, ...props }) => <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto my-4" {...props} />,
            a: ({ node, ...props }) => <a className="text-indigo-600 hover:text-indigo-700 underline" {...props} />,
            img: ({ node, ...props }) => <img className="max-w-full h-auto rounded-lg my-4 shadow-md" {...props} />,
            table: ({ node, ...props }) => <table className="w-full border-collapse border border-gray-300 my-4" {...props} />,
            thead: ({ node, ...props }) => <thead className="bg-gray-100" {...props} />,
            th: ({ node, ...props }) => <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props} />,
            td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-2" {...props} />,
          }}
        >
          {post.content}
        </ReactMarkdown>
      </article>
    </div>
  );
};