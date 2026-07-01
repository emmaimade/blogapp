import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { Calendar, ChevronRight, Eye } from 'lucide-react';
import { formatLocalDate, formatSmart } from '../utils/dates';
import api from '../api/blogApi';
import { Sidebar } from '../components/Sidebar';
import { Comments } from '../components/Comments';

type PostAuthor = {
  id: number;
  username: string;
  role?: string;
};

type PostDetailResponse = {
  id: number;
  title: string;
  content: string;
  slug: string;
  created_at: string;
  views?: number;
  thumbnail_url?: string;
  excerpt?: string;
  author_id?: number | null;
  author?: PostAuthor | null;
  tags: Array<{ id: number; name: string }>;
  comments?: any[];
};

export const PostDetail = () => {
  const { slug } = useParams();
  const location = useLocation();
  const initialPost = location.state?.post as PostDetailResponse | undefined;

  const { data: post, isLoading } = useQuery<PostDetailResponse>({
    queryKey: ['post', slug],
    queryFn: async () => (await api.get(`/posts/slug/${slug}`)).data,
    initialData: initialPost,
    staleTime: initialPost ? 1000 * 60 * 5 : 0 // keep initial data fresh for 5 minutes
  });

  // Reuse posts cache to provide popular posts in the sidebar
  const { data: postsCache } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => (await api.get('/posts/')).data,
    // we don't need to block rendering for sidebar; keep default options
  });

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    postsCache?.forEach((p: any) =>
      p.tags?.forEach((t: any) => set.add(t.name)),
    );
    return Array.from(set).sort();
  }, [postsCache]);

  const popularPosts = React.useMemo(() => {
    return [...(postsCache || [])]
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
  }, [postsCache]);

  const relatedPosts = React.useMemo(() => {
    if (!post || !postsCache?.length) return [];

    const currentTagNames = new Set(post.tags.map((tag) => tag.name));

    return postsCache
      .filter((candidate: any) => candidate.slug !== post.slug)
      .map((candidate: any) => {
        const sharedTags = candidate.tags?.filter((tag: any) => currentTagNames.has(tag.name)).length || 0;
        return { candidate, sharedTags };
      })
      .filter((item: any) => item.sharedTags > 0)
      .sort((a: any, b: any) => {
        if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags;
        return new Date(b.candidate.created_at).getTime() - new Date(a.candidate.created_at).getTime();
      })
      .slice(0, 3)
      .map((item: any) => item.candidate);
  }, [post, postsCache]);

  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading Story...</div>;
  if (!post) return <div className="h-screen flex items-center justify-center">Post not found.</div>;

  const authorName = post.author?.username ?? 'Unknown author';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-8">
        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 sm:mb-8">
          <a href="/" className="hover:text-primary">
            Home
          </a>
          <ChevronRight size={12} />
          <span className="text-zinc-900">{post.title}</span>
        </nav>

        {/* Article Header */}
        <header className="mb-10">
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag: any) => (
              <span
                key={tag.id}
                className="bg-purple-600 text-white text-[10px] px-3 py-1 rounded-full font-bold"
              >
                {tag.name}
              </span>
            ))}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 leading-tight mb-6 break-words">
            {post.title}
          </h1>

          {/* Author & Date */}
          <div className="flex flex-wrap items-center gap-6 text-zinc-500 border-y border-zinc-100 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-600 text-white rounded-2xl flex items-center justify-center font-bold shadow-inner">
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900">
                  Written by {authorName}
                </span>
                {post.author?.role && (
                  <span className="ml-2 text-[10px] uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2 py-px rounded">
                    {post.author.role}
                  </span>
                )}
              </div>
            </div>
            <span className="flex items-center gap-1 text-sm">
              <Calendar size={14} />{" "}
              {formatLocalDate(post.created_at)}
            </span>
            <span className="flex items-center gap-1 text-sm">
              <Eye size={14} />
              {(post.views || 0).toLocaleString()} views
            </span>
          </div>
        </header>

        {/* Article Content */}
        <article className="prose prose-slate max-w-none prose-img:rounded-3xl prose-headings:font-black prose-a:text-zinc-900 prose-pre:max-w-full prose-table:block prose-table:overflow-x-auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  className="text-4xl font-bold mb-6 mt-8 text-zinc-900"
                  {...props}
                />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  className="text-3xl font-bold mb-5 mt-7 text-zinc-900"
                  {...props}
                />
              ),
              h3: ({ node, ...props }) => (
                <h3
                  className="text-2xl font-bold mb-4 mt-6 text-zinc-900"
                  {...props}
                />
              ),
              p: ({ node, ...props }) => (
                <p className="mb-4 text-zinc-700 leading-relaxed" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul
                  className="list-disc list-inside mb-4 text-zinc-700 space-y-2"
                  {...props}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol
                  className="list-decimal list-inside mb-4 text-zinc-700 space-y-2"
                  {...props}
                />
              ),
              li: ({ node, ...props }) => <li className="ml-4" {...props} />,
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className="border-l-4 border-zinc-300 pl-4 py-2 my-4 bg-zinc-50 italic text-zinc-700"
                  {...props}
                />
              ),
              code: ({ node, className, children, ...props }) => {
                const isBlock = Boolean(className) || String(children).includes('\n');

                return !isBlock ? (
                  <code
                    className="bg-zinc-100 px-2 py-1 rounded text-sm font-mono text-rose-600"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code
                    className={`block bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4 ${className || ''}`.trim()}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ node, ...props }) => (
                <pre
                  className="bg-zinc-900 p-4 rounded-lg overflow-x-auto my-4"
                  {...props}
                />
              ),
              a: ({ node, ...props }) => (
                <a
                  className="text-zinc-900 hover:text-zinc-950 underline"
                  {...props}
                />
              ),
              img: ({ node, ...props }) => (
                <img
                  className="max-w-full h-auto rounded-3xl my-4 shadow-md"
                  {...props}
                />
              ),
              table: ({ node, ...props }) => (
                <table
                  className="w-full border-collapse border border-zinc-300 my-4"
                  {...props}
                />
              ),
              thead: ({ node, ...props }) => (
                <thead className="bg-zinc-100" {...props} />
              ),
              th: ({ node, ...props }) => (
                <th
                  className="border border-zinc-300 px-4 py-2 text-left font-semibold"
                  {...props}
                />
              ),
              td: ({ node, ...props }) => (
                <td className="border border-zinc-300 px-4 py-2" {...props} />
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </article>

        {relatedPosts.length > 0 && (
          <section className="mt-12 pt-8 border-t border-zinc-100">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Related Posts</h2>
                <p className="text-sm text-zinc-600 mt-1">
                  More stories in a similar vein.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {relatedPosts.map((relatedPost: any) => (
                <Link
                  key={relatedPost.id}
                  to={`/post/${relatedPost.slug}`}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-200 hover:shadow-lg"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-zinc-100">
                    <img
                      src={relatedPost.thumbnail_url || '/placeholder.jpg'}
                      alt={relatedPost.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {relatedPost.tags?.slice(0, 2).map((tag: any) => (
                        <span
                          key={`${relatedPost.id}-${tag.id ?? tag.name}`}
                          className="rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-bold text-zinc-900"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    <h3 className="text-lg font-bold leading-snug text-zinc-900 transition-colors group-hover:text-purple-600 line-clamp-2">
                      {relatedPost.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-zinc-600 line-clamp-2">
                      {relatedPost.excerpt || 'Read this related article for more context and detail.'}
                    </p>

                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-zinc-500">
                      <Calendar size={13} />
                      <span>{formatLocalDate(relatedPost.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Comments Section */}
        <Comments postId={post.id} comments={post.comments || []} />
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-4">
        <Sidebar popularPosts={popularPosts} tags={allTags} />
      </div>
    </div>
  );
};