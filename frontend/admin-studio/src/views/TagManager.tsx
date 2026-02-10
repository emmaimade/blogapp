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
    mutationFn: (name: string) => api.post(`/tags/?tag_name=${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      toast.success('Tag added successfully');
    },
    onError: () => toast.error('Failed to create tag')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => 
      api.patch(`/tags/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditingId(null);
      toast.success('Tag updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag removed');
    }
  });

  if (isLoading) return <div className="p-10 text-center animate-pulse">Loading taxonomy...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Taxonomy Management</h1>
          <p className="text-sm text-gray-500">Organize your blog categories and project stacks.</p>
        </div>
      </div>
      
      {/* Create Tag Input */}
      <div className="flex gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm border">
        <input 
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="New tag name (e.g. TypeScript)"
          className="flex-1 p-2 bg-transparent outline-none px-4"
          onKeyDown={(e) => e.key === 'Enter' && createMutation.mutate(newTagName)}
        />
        <button 
          onClick={() => createMutation.mutate(newTagName)}
          disabled={!newTagName}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          <Plus size={18} /> Add Tag
        </button>
      </div>

      {/* Tags List */}
      <div className="bg-white border rounded-xl shadow-sm divide-y overflow-hidden">
        {tags?.map(tag => (
          <div key={tag.id} className="flex justify-between items-center p-4 hover:bg-gray-50 transition">
            {editingId === tag.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input 
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="border rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={() => updateMutation.mutate({ id: tag.id, name: editValue })} className="text-green-600"><Check size={18}/></button>
                <button onClick={() => setEditingId(null)} className="text-red-400"><X size={18}/></button>
              </div>
            ) : (
              <span className="font-medium text-gray-700">#{tag.name}</span>
            )}
            
            <div className="flex gap-2">
              <button 
                onClick={() => { setEditingId(tag.id); setEditValue(tag.name); }}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                <Edit3 size={18} />
              </button>
              <button 
                onClick={() => setDeleteTarget(tag)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Tag?"
        message={`Are you sure you want to delete #${deleteTarget?.name}? This may affect filtered views in your portfolio.`}
      />
    </div>
  );
};