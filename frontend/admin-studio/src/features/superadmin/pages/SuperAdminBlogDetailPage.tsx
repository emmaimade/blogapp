import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle,
  ExternalLink,
  Globe,
  Loader2,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { SkeletonBar, SkeletonStatCard } from '../../../shared/ui/Skeleton';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const SuperAdminBlogDetailSkeleton = () => (
  <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
    <div className="space-y-3">
      <SkeletonBar className="h-4 w-32" />
      <SkeletonBar className="h-7 w-64" />
      <SkeletonBar className="h-4 w-48" />
    </div>

    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>

    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <SkeletonBar className="h-3 w-32" />
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <SkeletonBar className="h-3.5 w-24" />
            <SkeletonBar className="h-3.5 w-40" />
          </div>
        ))}
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <SkeletonBar className="h-3 w-28" />
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <SkeletonBar className="h-3.5 w-48" />
            <SkeletonBar className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface RecentPost {
  id: number;
  title: string;
  published: boolean;
  created_at: string;
  views: number;
}

interface Member {
  user_id: number;
  email: string;
  role: string;
  joined_at?: string | null;
}

interface BlogDetail {
  blog_id: number;
  name?: string;
  blog_name?: string;
  subdomain?: string;
  custom_domain?: string | null;
  is_active?: boolean;
  created_at: string;
  owner_email: string;
  total_posts?: number;
  posts_count?: number;
  total_views?: number;
  team_members?: number;
  last_activity?: string | null;
  recent_posts?: RecentPost[];
  members?: Member[];
}

export const SuperAdminBlogDetailPage = () => {
  const { blogId } = useParams<{ blogId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'suspend' | 'activate' | 'delete' | null;
  }>({ isOpen: false, type: null });

  const { data: blog, isLoading, error } = useQuery<BlogDetail>({
    queryKey: ['superadminBlog', blogId],
    queryFn: async () => (await api.get(`/superadmin/blogs/${blogId}`)).data,
    enabled: !!blogId,
  });

  useDocumentTitle(blog ? blog.name ?? blog.blog_name ?? 'Untitled workspace' : 'Blog');

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ is_active }: { is_active: boolean }) => {
      return (await api.patch(`/superadmin/blogs/${blogId}`, { is_active })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadminBlog', blogId] });
      queryClient.invalidateQueries({ queryKey: ['superadminBlogs'] });
      setConfirmModal({ isOpen: false, type: null });
    },
  });

  const deleteBlogMutation = useMutation({
    mutationFn: async () => {
      return (await api.delete(`/superadmin/blogs/${blogId}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadminBlogs'] });
      navigate('/admin/blogs');
    },
  });

  if (isLoading) {
    return <SuperAdminBlogDetailSkeleton />;
  }

  if (error || !blog) {
    return (
      <div className="space-y-4 p-6 text-center">
        <p className="text-red-500">Workspace not found or failed to load.</p>
        <Link
          to="/admin/blogs"
          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
        >
          <ArrowLeft size={14} /> Back to workspaces
        </Link>
      </div>
    );
  }

  const blogName = blog.name ?? blog.blog_name ?? 'Untitled workspace';
  const subdomain = blog.subdomain ?? 'workspace';
  const domain = blog.custom_domain ?? `${subdomain}.inko.blog`;
  const postsCount = blog.total_posts ?? blog.posts_count ?? 0;
  const viewsCount = blog.total_views ?? 0;
  const teamCount = blog.team_members ?? blog.members?.length ?? 0;
  const isActive = blog.is_active ?? true;
  const recentPosts = blog.recent_posts ?? [];
  const members = blog.members ?? [];

  const openModal = (type: 'suspend' | 'activate' | 'delete') => {
    setConfirmModal({ isOpen: true, type });
  };

  const closeModal = () => {
    setConfirmModal({ isOpen: false, type: null });
  };

  const getModalProps = () => {
    if (!confirmModal.type) return null;

    switch (confirmModal.type) {
      case 'suspend':
        return {
          title: 'Suspend Publication Workspace',
          message: `Are you sure you want to suspend "${blogName}"? This closes down public reader paths and locks data changes.`,
          confirmText: 'Suspend Workspace',
          isDanger: true,
        };
      case 'activate':
        return {
          title: 'Reactivate Publication Workspace',
          message: `Are you sure you want to restore "${blogName}"? This reactivates public viewer access routes instantly.`,
          confirmText: 'Reactivate Workspace',
          isDanger: false,
        };
      case 'delete':
        return {
          title: 'Catastrophic Purge Warning',
          message: `This action is completely irreversible.\n\nThis will permanently purge "${blogName.toUpperCase()}" including all posts, comment indexes, customized themes, and media data assets from the framework infrastructure.`,
          confirmText: 'Permanently Purge',
          isDanger: true,
        };
      default:
        return null;
    }
  };

  const activeModalProps = getModalProps();

  return (
    <div className="mx-auto max-w-full sm:max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link
            to="/admin/blogs"
            className="mb-1 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <ArrowLeft size={14} /> Back to workspaces
          </Link>

          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            {blogName}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Globe size={14} className="text-zinc-400" />
              {domain}
            </span>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
            >
              Visit site <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {isActive ? (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle size={12} /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <Ban size={12} /> Suspended
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Posts
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {postsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Views
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {viewsCount.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Team
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold text-zinc-900 dark:text-white">
            <Users size={18} className="text-zinc-400" />
            {teamCount}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Created
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
            {new Date(blog.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Workspace Details */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Workspace Details
          </h2>
        </div>
        <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Owner</dt>
            <dd className="truncate text-sm font-medium text-zinc-900 dark:text-white">
              {blog.owner_email || '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Subdomain</dt>
            <dd className="font-mono text-sm text-zinc-900 dark:text-white">
              {subdomain}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Custom Domain</dt>
            <dd className="font-mono text-sm text-zinc-900 dark:text-white">
              {blog.custom_domain || '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Last Activity</dt>
            <dd className="flex items-center gap-1.5 text-sm text-zinc-900 dark:text-white">
              <Calendar size={14} className="text-zinc-400" />
              {blog.last_activity
                ? new Date(blog.last_activity).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'No posts yet'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Blog ID</dt>
            <dd className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
              {blog.blog_id}
            </dd>
          </div>
        </dl>
      </div>

      {/* Recent Posts */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recent Posts
          </h2>
          <span className="text-xs text-zinc-400">
            {recentPosts.length} shown
          </span>
        </div>

        {recentPosts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            No posts yet
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentPosts.map((post) => (
              <li
                key={post.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {post.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    {post.views.toLocaleString()} views
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    post.published
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {post.published ? 'Published' : 'Draft'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Team Members */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Team Members
          </h2>
          <span className="text-xs text-zinc-400">{members.length} total</span>
        </div>

        {members.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            No members found
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {member.email}
                  </p>
                  {member.joined_at && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Joined{' '}
                      {new Date(member.joined_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-1">
        {isActive ? (
          <button
            onClick={() => openModal('suspend')}
            disabled={toggleActiveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
          >
            {toggleActiveMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Ban size={16} />
            )}
            Suspend Workspace
          </button>
        ) : (
          <button
            onClick={() => openModal('activate')}
            disabled={toggleActiveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
          >
            {toggleActiveMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Reactivate Workspace
          </button>
        )}

        <button
          onClick={() => openModal('delete')}
          disabled={deleteBlogMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          {deleteBlogMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
          Delete Workspace
        </button>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && activeModalProps && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={closeModal}
          title={activeModalProps.title}
          confirmText={activeModalProps.confirmText}
          isDanger={activeModalProps.isDanger}
          message={activeModalProps.message}
          validationMatch={
            confirmModal.type === 'delete' ? subdomain : undefined
          }
          onConfirm={() => {
            if (confirmModal.type === 'delete') {
              deleteBlogMutation.mutate();
            } else if (confirmModal.type === 'suspend') {
              toggleActiveMutation.mutate({ is_active: false });
            } else if (confirmModal.type === 'activate') {
              toggleActiveMutation.mutate({ is_active: true });
            }
          }}
        />
      )}
    </div>
  );
};