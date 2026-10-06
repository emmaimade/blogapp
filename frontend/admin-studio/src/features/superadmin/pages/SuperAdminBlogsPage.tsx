import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle,
  Eye,
  Globe,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { SkeletonBar, SkeletonListRow, TableRowSkeleton } from '../../../shared/ui/Skeleton';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const SuperAdminBlogsSkeleton = () => (
  <div className="space-y-6 p-6">
    <div className="space-y-2">
      <SkeletonBar className="h-7 w-56" />
      <SkeletonBar className="h-4 w-80" />
    </div>

    <SkeletonBar className="h-11 w-full max-w-md rounded-xl" />

    <div className="block md:hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
      {[...Array(4)].map((_, i) => (
        <SkeletonListRow key={i} withAvatar={false} />
      ))}
    </div>

    <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
            {['Blog Name', 'Routing / Domain', 'Owner Profile', 'Content Size', 'System Status', 'Actions'].map((h) => (
              <th key={h} className="p-4">
                <SkeletonBar className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <TableRowSkeleton columns={6} rows={5} cellClassName="p-4" />
        </tbody>
      </table>
    </div>
  </div>
);

interface BlogTenantItem {
  blog_id: number;
  name?: string;
  blog_name?: string;
  subdomain?: string;
  custom_domain?: string | null;
  is_active?: boolean;
  created_at: string;
  owner_email: string;
  posts_count?: number;
  total_posts?: number;
}

interface RowActionsProps {
  blog: BlogTenantItem;
  onOpenModal: (type: 'suspend' | 'activate' | 'delete', blog: BlogTenantItem) => void;
}

const RowActionsMenu = ({ blog, onOpenModal }: RowActionsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isBlogActive = blog.is_active ?? true;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
        aria-label="Actions menu"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 origin-top-right rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-100">
          <Link
            to={`/admin/blogs/${blog.blog_id}`}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <Eye size={14} /> View Workspace
          </Link>

          {isBlogActive ? (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenModal('suspend', blog);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            >
              <Ban size={14} /> Suspend Workspace
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenModal('activate', blog);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
            >
              <CheckCircle size={14} /> Activate Workspace
            </button>
          )}

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenModal('delete', blog);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 size={14} /> Delete Workspace
          </button>
        </div>
      )}
    </div>
  );
};

export const SuperAdminBlogsPage = () => {
  useDocumentTitle('Blogs');
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Track modal open state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'suspend' | 'activate' | 'delete' | null;
    blog: BlogTenantItem | null;
  }>({ isOpen: false, type: null, blog: null });

  // Fetch blogs query
  const { data: blogs, isLoading, error } = useQuery<BlogTenantItem[]>({
    queryKey: ['superadminBlogs'],
    queryFn: async () => (await api.get('/superadmin/blogs')).data,
  });

  // Toggle suspension state status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      blog_id,
      is_active,
    }: {
      blog_id: number;
      is_active: boolean;
    }) => {
      return (await api.patch(`/superadmin/blogs/${blog_id}`, { is_active }))
        .data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadminBlogs'] });
      closeModal();
    },
  });

  // Purge/Delete blog mutation
  const deleteBlogMutation = useMutation({
    mutationFn: async (blog_id: number) => {
      return (await api.delete(`/superadmin/blogs/${blog_id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadminBlogs'] });
      closeModal();
    },
  });

  const openModal = (
    type: 'suspend' | 'activate' | 'delete',
    blog: BlogTenantItem
  ) => {
    setConfirmModal({ isOpen: true, type, blog });
  };

  const closeModal = () => {
    setConfirmModal({ isOpen: false, type: null, blog: null });
  };

  // Filter rows cleanly checked for potential undefined string fields
  const filteredBlogs = blogs?.filter(
    (blog) =>
      (blog.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (blog.blog_name ?? '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (blog.subdomain ?? '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (blog.owner_email ?? '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <SuperAdminBlogsSkeleton />;
  }

  if (error) {
    return (
      <div className="p-5 text-center text-red-500">
        Error loading tenant configurations.
      </div>
    );
  }

  const getModalProps = () => {
    if (!confirmModal.blog || !confirmModal.type) return null;
    const blogName =
      confirmModal.blog.name ??
      confirmModal.blog.blog_name ??
      'this workspace';

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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
          Workspace Management
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Control global application instances, handle network abuse rules, or
          suspend active platforms.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 max-w-md">
        <Search size={18} className="text-zinc-400" />
        <input
          type="text"
          placeholder="Filter workspaces by title, subdomain..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none text-zinc-900 dark:text-white"
        />
      </div>

      {/* Mobile Flat List View */}
      <div className="block md:hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
        {filteredBlogs && filteredBlogs.length > 0 ? (
          filteredBlogs.map((blog) => {
            const blogName = blog.name ?? blog.blog_name ?? 'Untitled workspace';
            const blogSubdomain = blog.subdomain ?? 'workspace';
            const blogPostsCount = blog.posts_count ?? blog.total_posts ?? 0;
            const isBlogActive = blog.is_active ?? true;
            return (
              <div key={`mobile-${blog.blog_id}`} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/admin/blogs/${blog.blog_id}`} className="font-bold text-zinc-900 dark:text-white truncate block">{blogName}</Link>
                    <div className="text-xs text-zinc-500 mt-1 font-mono">{blog.custom_domain ? blog.custom_domain : `${blogSubdomain}.inko.blog`}</div>
                    <div className="text-xs text-zinc-500 mt-1">{blog.owner_email}</div>
                  </div>
                  <div className="shrink-0 text-right flex items-center gap-2">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">{blogPostsCount} posts</div>
                      <div className="mt-1">
                        {isBlogActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">Active</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Suspended</span>
                        )}
                      </div>
                    </div>
                    <RowActionsMenu blog={blog} onOpenModal={openModal} />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-sm text-zinc-500">No workspaces found.</div>
        )}
      </div>

      {/* Desktop Table Layout View */}
      <div className="hidden md:block border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="p-4">Blog Name</th>
                <th className="p-4">Routing / Domain</th>
                <th className="p-4">Owner Profile</th>
                <th className="p-4">Content Size</th>
                <th className="p-4">System Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              {filteredBlogs?.map((blog) => {
                const rowKey = `blog-id-${blog.blog_id}`;
                const blogName =
                  blog.name ?? blog.blog_name ?? 'Untitled workspace';
                const blogSubdomain = blog.subdomain ?? 'workspace';
                const blogPostsCount =
                  blog.posts_count ?? blog.total_posts ?? 0;
                const isBlogActive = blog.is_active ?? true;

                return (
                  <tr
                    key={rowKey}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="p-4">
                      <Link
                        to={`/admin/blogs/${blog.blog_id}`}
                        className="font-bold text-zinc-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                      >
                        {blogName}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        <Globe size={12} className="text-zinc-400" />
                        {blog.custom_domain
                          ? blog.custom_domain
                          : `${blogSubdomain}.inko.blog`}
                      </div>
                    </td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-300">
                      {blog.owner_email}
                    </td>
                    <td className="p-4 font-medium text-zinc-900 dark:text-white">
                      {blogPostsCount} posts
                    </td>
                    <td className="p-4">
                      {isBlogActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <Ban size={12} /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <RowActionsMenu blog={blog} onOpenModal={openModal} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmModal.isOpen && activeModalProps && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={closeModal}
          title={activeModalProps.title}
          confirmText={activeModalProps.confirmText}
          isDanger={activeModalProps.isDanger}
          onConfirm={() => {
            if (!confirmModal.blog?.blog_id) return;
            if (confirmModal.type === 'delete') {
              deleteBlogMutation.mutate(confirmModal.blog.blog_id);
            } else if (confirmModal.type === 'suspend') {
              toggleActiveMutation.mutate({
                blog_id: confirmModal.blog.blog_id,
                is_active: false,
              });
            } else if (confirmModal.type === 'activate') {
              toggleActiveMutation.mutate({
                blog_id: confirmModal.blog.blog_id,
                is_active: true,
              });
            }
          }}
          message={activeModalProps.message}
          validationMatch={
            confirmModal.type === 'delete'
              ? (confirmModal.blog?.subdomain ?? '')
              : undefined
          }
        />
      )}
    </div>
  );
};