import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, FileText, FolderOpen, Hash, MessageSquare, Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../shared/api/client';
import { type Post, type Tag } from '../../../shared/types';
import { formatLocalDate } from '../../../shared/utils/dates';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useAuth } from '../../auth/context/AuthContext';
import { canAccess } from '../../auth/lib/accessControl';

interface CommentHit {
  id: number;
  content: string;
  created_at: string;
  is_deleted: boolean;
  user: { username: string };
  post: { id: number; title: string };
}

const excerpt = (html: string, length = 140): string => {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
};

const EmptyState = ({ title, message }: { title: string; message: string }) => (
  <div className="admin-card flex flex-col items-center gap-3 p-16 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
      <Search size={22} className="text-zinc-400" />
    </div>
    <h3 className="font-bold text-zinc-900 dark:text-white">{title}</h3>
    <p className="text-sm text-zinc-500">{message}</p>
  </div>
);

const SectionSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {[...Array(2)].map((_, i) => (
      <div key={i} className="admin-card h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    ))}
  </div>
);

export const SearchResultsPage = () => {
  const navigate = useNavigate();
  const { activeBlog, activeMembership } = useBlog();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';

  const canSearchComments = canAccess(user, activeMembership, 'manage_comments');
  const canSearchTags = canAccess(user, activeMembership, 'manage_tags');

  const postsQuery = useQuery<Post[]>({
    queryKey: ['adminSearch', 'posts', activeBlog?.id, q],
    queryFn: async () =>
      (await api.get(`/blogs/${activeBlog!.id}/posts/search`, { params: { q, limit: 100 } })).data.items,
    enabled: !!activeBlog?.id && !!q,
  });

  const commentsQuery = useQuery<CommentHit[]>({
    queryKey: ['adminSearch', 'comments', activeBlog?.id, q],
    queryFn: async () =>
      (await api.get(`/blogs/${activeBlog!.id}/comments/`, { params: { q } })).data,
    enabled: !!activeBlog?.id && !!q && canSearchComments,
  });
  const commentResults = useMemo(
    () => (commentsQuery.data ?? []).filter((c) => !c.is_deleted),
    [commentsQuery.data],
  );

  const tagsQuery = useQuery<Tag[]>({
    queryKey: ['adminSearch', 'tagsList', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/tags/`)).data,
    enabled: !!activeBlog?.id && !!q && canSearchTags,
  });
  const tagResults = useMemo(
    () =>
      (tagsQuery.data ?? []).filter((t) => t.name.toLowerCase().includes(q.toLowerCase())),
    [tagsQuery.data, q],
  );

  if (!q) {
    return (
      <EmptyState
        title="Search your blog"
        message="Use the search bar above to find posts, comments and tags."
      />
    );
  }

  if (!activeBlog) {
    return (
      <EmptyState
        title="No workspace selected"
        message="Select a workspace to search its content."
      />
    );
  }

  const anyLoading =
    postsQuery.isLoading ||
    (canSearchComments && commentsQuery.isLoading) ||
    (canSearchTags && tagsQuery.isLoading);

  const totalResults =
    (postsQuery.data?.length ?? 0) + commentResults.length + tagResults.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
          Search results for &ldquo;{q}&rdquo;
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {anyLoading ? 'Searching…' : `${totalResults} result${totalResults === 1 ? '' : 's'} found.`}
        </p>
      </div>

      {!anyLoading && totalResults === 0 && (
        <EmptyState
          title="No results found"
          message={`Nothing matched "${q}". Posts search only covers published posts.`}
        />
      )}

      {/* Posts */}
      {postsQuery.isLoading && <SectionSkeleton />}
      {!postsQuery.isLoading && (postsQuery.data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Posts · {postsQuery.data!.length}
          </h2>
          <div className="admin-card divide-y divide-zinc-200 overflow-hidden dark:divide-zinc-800">
            {postsQuery.data!.map((post) => (
              <button
                key={post.id}
                onClick={() => navigate(`/admin/posts/view/${post.id}`)}
                className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {post.is_project ? <><FolderOpen size={10} /> Project</> : <><FileText size={10} /> Post</>}
                  </span>
                  <span className="text-xs text-zinc-400">{formatLocalDate(post.created_at)}</span>
                </div>
                <div className="font-bold text-zinc-900 dark:text-white">{post.title}</div>
                {post.content && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">
                    {excerpt(post.content)}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                  <span>{post.author?.username || 'Unknown'}</span>
                  <span className="flex items-center gap-1"><Eye size={12} /> {post.views}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {canSearchComments && commentsQuery.isLoading && <SectionSkeleton />}
      {canSearchComments && !commentsQuery.isLoading && commentResults.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Comments · {commentResults.length}
          </h2>
          <div className="admin-card divide-y divide-zinc-200 overflow-hidden dark:divide-zinc-800">
            {commentResults.map((comment) => (
              <button
                key={comment.id}
                onClick={() => navigate(`/admin/posts/view/${comment.post.id}`)}
                className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <MessageSquare size={12} />
                  <span className="truncate">on {comment.post.title}</span>
                  <span>·</span>
                  <span>{formatLocalDate(comment.created_at)}</span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">{comment.content}</p>
                <span className="text-xs text-zinc-500">{comment.user.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {canSearchTags && tagsQuery.isLoading && <SectionSkeleton />}
      {canSearchTags && !tagsQuery.isLoading && tagResults.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Tags · {tagResults.length}
          </h2>
          <div className="admin-card flex flex-wrap gap-2 p-4">
            {tagResults.map((tag) => (
              <button
                key={tag.id}
                onClick={() => navigate('/admin/tags')}
                className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-violet-900/40 dark:hover:text-violet-300"
              >
                <Hash size={12} /> {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
