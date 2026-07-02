import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  ArrowLeft, Edit, Calendar, Tag as TagIcon,
  Eye, Clock, CheckCircle2, FileText,
} from 'lucide-react';
import 'highlight.js/styles/atom-one-dark.css';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { formatLocalDate, formatScheduled } from '../../../shared/utils/dates';
import { type Post } from '../../../shared/types';

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status, publishedAt }: { status: string; publishedAt?: string | null }) => {
  const cfg = {
    published: {
      icon: <CheckCircle2 size={12} />,
      label: 'Published',
      cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    },
    scheduled: {
      icon: <Clock size={12} />,
      label: 'Scheduled',
      cls: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    },
    draft: {
      icon: <FileText size={12} />,
      label: 'Draft',
      cls: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    },
  }[status] ?? {
    icon: <FileText size={12} />,
    label: status,
    cls: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  };

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}>
        {cfg.icon} {cfg.label}
      </span>
      {status === 'scheduled' && publishedAt && (
        <span className="text-xs text-yellow-600 dark:text-yellow-500 pl-1">
          Publishes {formatScheduled(publishedAt)}
        </span>
      )}
    </div>
  );
};

// ── Markdown components ───────────────────────────────────────────────────────
const markdownComponents: Components = {
  h1: ({ node, ...props }) => <h1 className="text-4xl font-bold mb-6 mt-8 text-zinc-900 dark:text-white" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-3xl font-bold mb-5 mt-7 text-zinc-900 dark:text-white" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mb-4 mt-6 text-zinc-900 dark:text-white" {...props} />,
  p:  ({ node, ...props }) => <p className="mb-4 text-zinc-700 dark:text-zinc-300 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 text-zinc-700 dark:text-zinc-300 space-y-2" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 text-zinc-700 dark:text-zinc-300 space-y-2" {...props} />,
  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 border-violet-300 pl-4 py-2 my-4 bg-violet-50 dark:bg-violet-950/30 italic text-zinc-700 dark:text-zinc-300" {...props} />
  ),
  code: ({ node, className, ...props }) => (
    <code
      className={
        className?.includes('language-')
          ? 'block overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100'
          : 'rounded bg-zinc-200 dark:bg-zinc-700 px-2 py-1 font-mono text-sm text-red-600 dark:text-red-300'
      }
      {...props}
    />
  ),
  pre:   ({ node, ...props }) => <pre className="my-4 overflow-x-auto rounded-lg bg-zinc-900 p-4" {...props} />,
  a:     ({ node, ...props }) => <a className="text-violet-600 hover:text-violet-700 underline dark:text-violet-400" {...props} />,
  img:   ({ node, ...props }) => <img className="my-4 h-auto max-w-full rounded-lg shadow-md" {...props} />,
  table: ({ node, ...props }) => <table className="my-4 w-full border-collapse border border-zinc-300 dark:border-zinc-700" {...props} />,
  thead: ({ node, ...props }) => <thead className="bg-zinc-100 dark:bg-zinc-800" {...props} />,
  th:    ({ node, ...props }) => <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left font-semibold text-zinc-900 dark:text-white" {...props} />,
  td:    ({ node, ...props }) => <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-zinc-700 dark:text-zinc-300" {...props} />,
};

// ── Component ─────────────────────────────────────────────────────────────────
export const PostView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeBlog } = useBlog();

  const { data: post, isLoading, isError } = useQuery<Post>({
    queryKey: ['post', id, activeBlog?.id],
    queryFn: async () =>
      (await api.get(`/blogs/${activeBlog!.id}/posts/${id}`)).data,
    enabled: !!id && !!activeBlog?.id,
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="admin-page max-w-4xl space-y-6 animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="h-5 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-6 w-32 rounded bg-zinc-100 dark:bg-zinc-800/50" />
          </div>
          <div className="h-10 w-3/4 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800/50" />
        </div>
        <div className="h-64 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800/50" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-4 rounded bg-zinc-100 dark:bg-zinc-800/50 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="admin-page max-w-4xl flex flex-col items-center gap-4 py-20 text-center">
        <FileText size={32} className="text-zinc-300 dark:text-zinc-600" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Post not found</h2>
        <p className="text-sm text-zinc-500">This post may have been deleted or you don't have access.</p>
        <button
          onClick={() => navigate('/admin/posts')}
          className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-all"
        >
          Back to posts
        </button>
      </div>
    );
  }

  const postStatus = post.status ?? (post.published ? 'published' : 'draft');

  return (
    <div className="admin-page max-w-4xl">

      {/* ─── Top bar ─── */}
      <div className="mb-8 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <button
          onClick={() => navigate('/admin/posts')}
          className="flex items-center gap-2 text-zinc-500 transition hover:text-primary dark:text-zinc-400 dark:hover:text-violet-400"
        >
          <ArrowLeft size={18} /> Back to posts
        </button>
        <button
          onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
        >
          <Edit size={16} /> Edit post
        </button>
      </div>

      {/* ─── Header ─── */}
      <header className="mb-8 space-y-4">

        {/* Status + type row */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={postStatus} publishedAt={post.published_at} />
          {post.is_project && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <FileText size={12} /> Project
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white sm:text-4xl leading-tight">
          {post.title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          {/* Author */}
          {post.author && (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0">
                {(post.author.username || '?').charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {post.author.username}
              </span>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span>
              {postStatus === 'scheduled' && post.published_at
                ? `Scheduled for ${formatScheduled(post.published_at)}`
                : postStatus === 'published' && post.published_at
                ? `Published ${formatLocalDate(post.published_at)}`
                : `Created ${formatLocalDate(post.created_at)}`
              }
            </span>
          </div>

          {/* Views */}
          {postStatus === 'published' && (
            <div className="flex items-center gap-1.5">
              <Eye size={14} />
              <span>{post.views.toLocaleString()} view{post.views !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent border border-accent-border px-3 py-1 text-xs font-semibold text-accent-text dark:bg-violet-950/40 dark:border-violet-800/50 dark:text-violet-300"
              >
                <TagIcon size={11} /> {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Thumbnail */}
        {post.thumbnail_url && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <img
              src={post.thumbnail_url}
              alt={post.title}
              className="h-64 w-full object-cover sm:h-80"
            />
          </div>
        )}
      </header>

      {/* ─── Content ─── */}
      <article className="admin-card prose prose-zinc dark:prose-invert max-w-none rounded-2xl p-6 sm:p-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {post.content}
        </ReactMarkdown>
      </article>

      {/* ─── Footer meta ─── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-5 py-4 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="space-y-1">
          <p>Created {formatLocalDate(post.created_at)}</p>
          {post.updated_at !== post.created_at && (
            <p>Updated {formatLocalDate(post.updated_at)}</p>
          )}
        </div>
        <button
          onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-all"
        >
          <Edit size={13} /> Edit this post
        </button>
      </div>
    </div>
  );
};