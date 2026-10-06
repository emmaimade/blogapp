import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertTriangle, ArrowUp, EyeOff, FileQuestion } from 'lucide-react';
import { countMarkdownHeadings, getPlainExcerpt, slugify } from '../utils/posts';
import { getThumbnailUrl, handleThumbnailError } from '../utils/images';
import api from '../api/blogApi';
import { Comments } from '../components/Comments';
import { ArticleSkeleton } from '../components/Skeletons';
import { ArticleHeader } from '../components/post/ArticleHeader';
import { ArticleBody } from '../components/post/ArticleBody';
import { MobileTableOfContents, TableOfContents, type TocEntry } from '../components/post/TableOfContents';
import { RelatedPosts } from '../components/post/RelatedPosts';
import { useSiteName } from '../hooks/useSiteSettings';
import { useSidebarData } from '../hooks/useSidebarData';
import { applyPageMeta, captureCurrentMeta } from '../utils/seo';
import type { Post, PostDetail as PostDetailData } from '../types/post';

const isNotFound = (err: unknown) => isAxiosError(err) && err.response?.status === 404;

export const PostDetail = () => {
  const { slug } = useParams();
  const location = useLocation();
  const initialPost = location.state?.post as PostDetailData | undefined;

  const { data: post, isLoading, isError, error } = useQuery<PostDetailData>({
    queryKey: ['post', slug],
    queryFn: async () => (await api.get(`/posts/slug/${slug}`)).data,
    initialData: initialPost,
    staleTime: initialPost ? 1000 * 60 * 5 : 0, // keep initial data fresh for 5 minutes
    retry: (failureCount, err) => !isNotFound(err) && failureCount < 2,
  });

  // Related posts are ranked by tag overlap on the server, across the whole
  // blog. When a post has none, popular posts stand in so the end of the
  // article always offers somewhere to go next.
  const { data: relatedPosts = [] } = useQuery<Post[]>({
    queryKey: ['posts', 'related', slug],
    queryFn: async () => (await api.get(`/posts/slug/${slug}/related`, { params: { limit: 3 } })).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
  const { popularPosts } = useSidebarData();

  const siteName = useSiteName();

  React.useEffect(() => {
    if (!post) return;
    const previous = captureCurrentMeta();
    applyPageMeta({
      title: `${post.title} · ${siteName}`,
      description: getPlainExcerpt(post.content),
      ogImage: post.thumbnail_url,
    });
    return () => applyPageMeta(previous);
  }, [post, siteName]);

  // Reading progress, measured against the article body itself (not the
  // whole page) so the bar fills exactly as the reader moves through it —
  // unaffected by the header/sidebar/comments around it.
  const articleRef = React.useRef<HTMLElement>(null);
  const [readingProgress, setReadingProgress] = React.useState(0);
  const [showBackToTop, setShowBackToTop] = React.useState(false);

  React.useEffect(() => {
    if (!post) return;

    const handleScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      const progress = scrollable > 0 ? (scrolled / scrollable) * 100 : 0;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
      setShowBackToTop(window.scrollY > 800);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [post]);

  // Table of contents, built from the rendered article headings (h2-h4 — the
  // body only demotes an author's `#`, so the page keeps a single <h1>). Runs
  // after the markdown commits so the heading elements exist to tag with ids.
  const [toc, setToc] = React.useState<TocEntry[]>([]);

  React.useEffect(() => {
    if (!post) return;
    const el = articleRef.current;
    if (!el) return;

    const headings = Array.from(el.querySelectorAll('h2, h3, h4')) as HTMLElement[];
    const seen = new Map<string, number>();
    const entries = headings.map((heading) => {
      const text = heading.textContent || '';
      const base = slugify(text) || 'section';
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      heading.id = id;
      return { id, text, level: Number(heading.tagName[1]) };
    });
    setToc(entries);
  }, [post]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <ArticleSkeleton />
      </div>
    );
  }

  if (!post) {
    const isNetworkError = isError && !isNotFound(error);

    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 dark:bg-zinc-800">
          {isNetworkError ? (
            <AlertTriangle className="text-zinc-400" size={28} />
          ) : (
            <FileQuestion className="text-zinc-400" size={28} />
          )}
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          {isNetworkError ? 'Something went wrong' : 'Post not found'}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-sm">
          {isNetworkError
            ? "We couldn't load this post. Check your connection and try again."
            : 'This post may have been moved or no longer exists.'}
        </p>
        {isNetworkError ? (
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try again
          </button>
        ) : (
          <Link
            to="/blog"
            className="btn-primary"
          >
            Browse all posts
          </Link>
        )}
      </div>
    );
  }

  // The layout is decided from the Markdown source, before render — the TOC
  // entries themselves only exist after the body mounts, and switching
  // between the centred and sidebar layouts then would shift the article.
  const hasToc = countMarkdownHeadings(post.content) > 1;
  const nextPosts = relatedPosts.length > 0
    ? relatedPosts
    : popularPosts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <>
      {/* Reading progress — a thin line along the sticky navbar's bottom edge
          (h-16), below it in the stack so the navbar's menus open over it. */}
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(readingProgress)}
        className="fixed top-16 left-0 right-0 z-40 h-0.5 pointer-events-none"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150 motion-reduce:transition-none"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div
        className={
          hasToc
            ? 'max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12'
            : 'max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10'
        }
      >
        {/* One reading column: header, image, body, related and comments all
            share the same left edge and a comfortable line length. */}
        <div className={hasToc ? 'lg:col-span-8 min-w-0' : 'min-w-0'}>
          <div className="max-w-3xl mx-auto lg:mx-0">
            {/* Only staff ever get an unpublished post back (signed in, by
                direct link) — make it unmistakable that it isn't live. */}
            {post.status && post.status !== 'published' && (
              <div
                role="status"
                className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <EyeOff size={18} className="mt-0.5 shrink-0" />
                <p>
                  <span className="font-bold">{post.status === 'scheduled' ? 'Scheduled' : 'Draft'}</span>
                  {' — '}only visible to you because you're signed in as staff. Readers can't see this post yet.
                </p>
              </div>
            )}

            <ArticleHeader post={post} />

            {post.thumbnail_url && (
              <div className="mb-10 aspect-video overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={getThumbnailUrl(post.thumbnail_url, 1200)}
                  onError={handleThumbnailError}
                  alt={post.title}
                  className="h-full w-full object-cover"
                  // The page's largest above-the-fold image — load it first, not lazily.
                  fetchPriority="high"
                />
              </div>
            )}

            {toc.length > 1 && <MobileTableOfContents entries={toc} />}

            <ArticleBody ref={articleRef} content={post.content} />

            {relatedPosts.length > 0 ? (
              <RelatedPosts posts={nextPosts} />
            ) : (
              <RelatedPosts posts={nextPosts} title="Popular posts" subtitle="What other readers are enjoying." />
            )}

            <Comments postId={post.id} comments={post.comments || []} />
          </div>
        </div>

        {/* Sidebar — the table of contents only, so nothing competes with the article */}
        {hasToc && (
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              {toc.length > 1 && <TableOfContents entries={toc} />}
            </div>
          </div>
        )}
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-50 p-3 bg-zinc-900 text-white rounded-full shadow-lg hover:bg-zinc-700 transition-all animate-fadeIn dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </>
  );
};
