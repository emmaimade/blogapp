import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit3, Plus, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { type Tag } from '../types';
import { Modal } from '../components/Modal';

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
    mutationFn: (name: string) => api.post('/tags/', { name }), // ✅ FIXED: Send as JSON body
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
      setDeleteTarget(null); // ✅ Close modal after delete
      toast.success('Tag removed');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete tag';
      toast.error(errorMsg);
    }
  });

  // ✅ NEW: Validate tag name before submission
  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }
    
    // Check for duplicate (case-insensitive)
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
    <div className="flex h-64 items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading tags...</div>
    </div>
  );

  return (
    <div className="admin-page max-w-3xl">
      <div className="flex justify-between items-center gap-4 mb-8">
        <input 
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="New tag name (e.g. React, TypeScript, Web Dev)"
          className="admin-input flex-1 pl-10 py-2.5 text-sm placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-slate-900"
          onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
        />
        <button 
          onClick={handleCreateTag}
          disabled={!newTagName.trim() || createMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus size={18} /> Add Tag
            </>
          )}
        </button>
      </div>

      {tags && tags.length > 0 ? (
        <div className="admin-card divide-y divide-[rgba(126,92,54,0.08)] overflow-hidden rounded-[1.7rem]">
          {tags.map(tag => (
            <div key={tag.id} className="admin-table-row flex items-center justify-between p-4 transition-colors">
              {editingId === tag.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input 
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="admin-input max-w-sm px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateMutation.mutate({ id: tag.id, name: editValue });
                      }
                      if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                  />
                  <button 
                    onClick={() => updateMutation.mutate({ id: tag.id, name: editValue })}
                    disabled={!editValue.trim() || updateMutation.isPending}
                    className="rounded-xl p-2 text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                  >
                    <Check size={18}/>
                  </button>
                  <button 
                    onClick={() => setEditingId(null)} 
                    className="rounded-xl p-2 text-red-400 transition hover:bg-red-50"
                  >
                    <X size={18}/>
                  </button>
                </div>
              ) : (
                <>
                  <span className="admin-badge bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">#{tag.name}</span>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { 
                        setEditingId(tag.id); 
                        setEditValue(tag.name); 
                      }}
                      className="admin-icon-btn admin-icon-btn-edit"
                      title="Edit tag"
                      aria-label={`Edit ${tag.name}`}
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => setDeleteTarget(tag)}
                      className="admin-icon-btn admin-icon-btn-delete"
                      title="Delete tag"
                      aria-label={`Delete ${tag.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-section border-dashed bg-transparent p-12 text-center">
          <p className="mb-2 text-slate-500 dark:text-slate-400">No tags yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create your first tag to get started organizing your content</p>
        </div>
      )}

      <Modal 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Tag?"
        message={`Are you sure you want to delete #${deleteTarget?.name}? This will remove it from all posts.`}
      />
    </div>
  );
};
