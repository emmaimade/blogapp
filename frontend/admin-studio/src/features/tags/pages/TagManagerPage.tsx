import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit3, Plus, X, Check, Tag as TagIcon, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { type Tag } from '../../../shared/types';

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
];

const getColorForTag = (tagName: string) => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

export const TagManager = () => {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const { data: tags, isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/tags/')).data
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/tags/', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      toast.success('Tag added successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to create tag';
      toast.error(errorMsg);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => 
      api.patch(`/tags/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditingId(null);
      toast.success('Tag updated');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update tag';
      toast.error(errorMsg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setDeleteTarget(null);
      toast.success('Tag removed');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete tag';
      toast.error(errorMsg);
    }
  });

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }
    const duplicate = tags?.find(
      tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    if (duplicate) {
      toast.error(`Tag "${duplicate.name}" already exists`);
      return;
    }
    createMutation.mutate(newTagName.trim());
  };

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      {/* Skeleton Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="h-10 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-10 w-full md:w-28 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Skeleton Tag Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex gap-1">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
              </div>
            </div>
            <div>
              <div className="h-5 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-3 w-12 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="w-full flex items-center relative">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name (e.g. React, Design)"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-11 pr-4 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-violet-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
          />
        </div>
        <button 
          onClick={handleCreateTag}
          disabled={!newTagName.trim() || createMutation.isPending}
          className="w-full md:w-auto flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 active:scale-95 disabled:opacity-50 transition-all"
        >
          {createMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Plus size={16} />
          )}
          Add Tag
        </button>
      </div>

      {/* ─── Tag Grid ─── */}
      {tags && tags.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tags.map(tag => (
            <div key={tag.id} className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border border-zinc-200 transition-all hover:shadow-md hover:border-violet-200 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-violet-900/50">
              {editingId === tag.id ? (
                <div className="flex flex-col gap-3">
                  <input 
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateMutation.mutate({ id: tag.id, name: editValue });
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateMutation.mutate({ id: tag.id, name: editValue })}
                      disabled={!editValue.trim() || updateMutation.isPending}
                      className="flex-1 rounded-lg bg-emerald-100 py-1.5 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 flex justify-center transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => setEditingId(null)} 
                      className="flex-1 rounded-lg bg-zinc-100 py-1.5 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 flex justify-center transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getColorForTag(tag.name)}`}>
                      <TagIcon size={18} />
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button 
                        onClick={() => { setEditingId(tag.id); setEditValue(tag.name); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                        aria-label={`Edit ${tag.name}`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteTarget(tag)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white line-clamp-1" title={tag.name}>
                      {tag.name}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-zinc-500 uppercase tracking-widest">
                      Tag
                    </p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 py-24 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <TagIcon size={32} className="text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Organize your content</h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Tags help your readers discover related posts. Add your first tag using the input above.
            </p>
          </div>
        </div>
      )}

      <Modal 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Tag"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? It will be removed from all associated posts.`}
      />
    </div>
  );
};
