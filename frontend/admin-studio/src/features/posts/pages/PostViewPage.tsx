import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ArrowLeft, Edit, Calendar, Tag as TagIcon } from 'lucide-react';
import 'highlight.js/styles/atom-one-dark.css';
import api from '../../../shared/api/client';
import { type Post } from '../../../shared/types';

export const PostView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: post, isLoading } = useQuery<Post>({
    queryKey: ['post', id],
    queryFn: async () => (await api.get(`/posts/${id}`)).data,
  });

  const markdownComponents: Components = {
    h1: ({ node, ...props }) => <h1 className="text-4xl font-bold mb-6 mt-8 text-zinc-900" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-3xl font-bold mb-5 mt-7 text-zinc-900" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mb-4 mt-6 text-zinc-900" {...props} />,
    p: ({ node, ...props }) => <p className="mb-4 text-zinc-700 leading-relaxed" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 text-zinc-700 space-y-2" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 text-zinc-700 space-y-2" {...props} />,
    li: ({ node, ...props }) => <li className="ml-4" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-zinc-300 pl-4 py-2 my-4 bg-zinc-50 italic text-zinc-700" {...props} />,
    code: ({ node, className, ...props }) => (
      <code
        className={className?.includes('language-')
          ? "block overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100"
          : "rounded bg-zinc-200 px-2 py-1 font-mono text-sm text-red-600"}
        {...props}
      />
    ),
    pre: ({ node, ...props }) => <pre className="my-4 overflow-x-auto rounded-lg bg-zinc-900 p-4" {...props} />,
    a: ({ node, ...props }) => <a className="text-zinc-900 hover:text-zinc-950 underline" {...props} />,
    img: ({ node, ...props }) => <img className="my-4 h-auto max-w-full rounded-lg shadow-md" {...props} />,
    table: ({ node, ...props }) => <table className="my-4 w-full border-collapse border border-zinc-300" {...props} />,
    thead: ({ node, ...props }) => <thead className="bg-zinc-100" {...props} />,
    th: ({ node, ...props }) => <th className="border border-zinc-300 px-4 py-2 text-left font-semibold" {...props} />,
    td: ({ node, ...props }) => <td className="border border-zinc-300 px-4 py-2" {...props} />,
  };

  if (isLoading) return <div className="p-20 text-center animate-pulse text-zinc-500 dark:text-zinc-400">Loading post...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500 dark:text-zinc-400">Post not found.</div>;

  return (
    <div className="admin-page max-w-4xl">
      {/* Admin Header Actions */}
      <div className="mb-8 flex items-center justify-between border-b border-[var(--admin-line)] pb-4">
        <button 
          onClick={() => navigate('/admin/posts')}
          className="flex items-center gap-2 text-zinc-500 transition hover:text-primary dark:text-zinc-400 dark:hover:text-purple-300"
        >
          <ArrowLeft size={20} /> Back to List
        </button>
        <button 
          onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
          className="admin-btn admin-btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Edit size={18} /> Edit Post
        </button>
      </div>

      {/* Post Metadata */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          {!post.published && (
            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold uppercase dark:bg-purple-950/60 dark:text-purple-300">Draft</span>
          )}
          <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <Calendar size={14} /> {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>
        <h1 className="mb-4 text-4xl font-extrabold text-zinc-900 dark:text-white">{post.title}</h1>
        
        <div className="flex gap-2">
          {post.tags?.map(tag => (
            <span key={tag.id} className="admin-badge bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <TagIcon size={12} /> {tag.name}
            </span>
          ))}
        </div>
      </header>

      {/* Rendered Content */}
      <article className="admin-card prose prose-lg max-w-none p-8 dark:prose-invert">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {post.content}
        </ReactMarkdown>
      </article>
    </div>
  );
};
