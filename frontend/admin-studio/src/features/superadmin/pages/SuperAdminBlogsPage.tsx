import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Ban, CheckCircle,
    Globe,
    Loader2,
    Search,
    Trash2
} from 'lucide-react';
import { useState } from 'react';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';

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

export const SuperAdminBlogsPage = () => {
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
    mutationFn: async ({ blog_id, is_active }: { blog_id: number; is_active: boolean }) => {
      return (await api.patch(`/superadmin/blogs/${blog_id}`, { is_active })).data;
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

  const openModal = (type: 'suspend' | 'activate' | 'delete', blog: BlogTenantItem) => {
    setConfirmModal({ isOpen: true, type, blog });
  };

  const closeModal = () => {
    setConfirmModal({ isOpen: false, type: null, blog: null });
  };

  // Filter rows cleanly checked for potential undefined string fields
  const filteredBlogs = blogs?.filter(blog => 
    (blog.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (blog.blog_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (blog.subdomain ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (blog.owner_email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return <div className="p-5 text-center text-red-500">Error loading tenant configurations.</div>;
  }

  const getModalProps = () => {
    if (!confirmModal.blog || !confirmModal.type) return null;
    const blogName = confirmModal.blog.name ?? confirmModal.blog.blog_name ?? 'this workspace';

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

      <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
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
              const blogName = blog.name ?? blog.blog_name ?? "Untitled workspace";
              const blogSubdomain = blog.subdomain ?? "workspace";
              const blogPostsCount = blog.posts_count ?? blog.total_posts ?? 0;
              const isBlogActive = blog.is_active ?? true;

              return (
                <tr
                  key={rowKey}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="p-4 font-bold text-zinc-900 dark:text-white">
                    {blogName}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      <Globe size={12} className="text-zinc-400" />
                      {blog.custom_domain ? blog.custom_domain : `${blogSubdomain}.inko.blog`}
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
                  <td className="p-4 text-right space-x-1">
                    {isBlogActive ? (
                      <button
                        onClick={() => openModal("suspend", blog)}
                        className="inline-flex p-2 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                        title="Suspend Publication"
                      >
                        <Ban size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal("activate", blog)}
                        className="inline-flex p-2 rounded-xl text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                        title="Activate Publication"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => openModal("delete", blog)}
                      className="inline-flex p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Purge Workspace Cascade"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
            if (confirmModal.type === "delete") {
              deleteBlogMutation.mutate(confirmModal.blog.blog_id);
            } else if (confirmModal.type === "suspend") {
              toggleActiveMutation.mutate({
                blog_id: confirmModal.blog.blog_id,
                is_active: false,
              });
            } else if (confirmModal.type === "activate") {
              toggleActiveMutation.mutate({
                blog_id: confirmModal.blog.blog_id,
                is_active: true,
              });
            }
          }}
          message={activeModalProps.message}
          validationMatch={
            confirmModal.type === "delete"
              ? (confirmModal.blog?.subdomain ?? "")
              : undefined
          }
        />
      )}
    </div>
  );
};