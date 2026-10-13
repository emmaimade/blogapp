import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit3, Plus, X, Check, Tag as TagIcon, Hash, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { Modal } from '../../../shared/components/Modal';
import { type Tag, type TagUsage } from '../../../shared/types';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';

const HIGHLIGHT_MS = 2000;

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// The API puts field problems in `errors.name` and the summary in `detail`
// (a string, except on 422s where it's FastAPI's list of issues).
const apiErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { detail?: unknown; errors?: Record<string, string> } } })
    .response?.data;
  if (data?.errors?.name) return data.errors.name;
  return typeof data?.detail === 'string' ? data.detail : fallback;
};

export const TagManager = () => {
  useDocumentTitle('Tags');
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const [newTagName, setNewTagName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagUsage | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  // Mirrors editingId so a blur that fires as the input unmounts (after Esc
  // or ✗) can tell the edit is already over and mustn't save.
  const editingRef = useRef<number | null>(null);

  const { data: tags, isLoading, isError, refetch, isFetching } = useQuery<TagUsage[]>({
    queryKey: ['tags', activeBlog?.id, 'usage'],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/tags/usage`)).data,
    enabled: !!activeBlog?.id,
  });

  // Prefix match: refreshes this page's counts and the post editor's tag list.
  const invalidateTags = () => queryClient.invalidateQueries({ queryKey: ['tags', activeBlog?.id] });

  useEffect(() => {
    if (highlightId === null) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const startEditing = (tag: TagUsage) => {
    editingRef.current = tag.id;
    setEditingId(tag.id);
    setEditValue(tag.name);
    setEditError(null);
  };

  const stopEditing = () => {
    editingRef.current = null;
    setEditingId(null);
    setEditError(null);
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => (await api.post<Tag>(`/blogs/${activeBlog!.id}/tags/`, { name })).data,
    // Returning the refetch keeps the mutation pending until the new tag is
    // in the list, so the highlight starts once there's something to see.
    onSuccess: async (tag) => {
      setNewTagName('');
      toast.success(`Tag "${tag.name}" added`);
      await invalidateTags();
      setHighlightId(tag.id);
    },
    onError: (error) => setFormError(apiErrorMessage(error, 'Failed to add tag')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch(`/blogs/${activeBlog!.id}/tags/${id}`, { name }),
    onSuccess: () => {
      invalidateTags();
      stopEditing();
      toast.success('Tag renamed');
    },
    onError: (error) => setEditError(apiErrorMessage(error, 'Failed to rename tag')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/blogs/${activeBlog!.id}/tags/${id}`),
    onSuccess: () => {
      invalidateTags();
      setDeleteTarget(null);
      toast.success('Tag deleted');
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete tag')),
  });

  // While a new tag saves, show the full list rather than a "no match" panel
  // for a tag that's about to exist.
  const query = createMutation.isPending ? '' : newTagName.trim().toLowerCase();
  const visibleTags = tags?.filter(tag => tag.name.toLowerCase().includes(query)) ?? [];
  const findByName = (name: string, excludeId?: number) =>
    tags?.find(tag => tag.id !== excludeId && tag.name.toLowerCase() === name.toLowerCase());

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) {
      setFormError('Enter a tag name');
      return;
    }
    const duplicate = findByName(name);
    if (duplicate) {
      setFormError(`"${duplicate.name}" already exists`);
      return;
    }
    createMutation.mutate(name);
  };

  // Enter, ✓ and clicking away all land here. An unchanged name just closes;
  // on blur a blank name reverts rather than nagging.
  const commitEdit = (tag: TagUsage, { fromBlur = false } = {}) => {
    if (editingRef.current !== tag.id || updateMutation.isPending) return;
    const name = editValue.trim();
    if (name === tag.name || (!name && fromBlur)) {
      stopEditing();
      return;
    }
    if (!name) {
      setEditError("Tag name can't be empty");
      return;
    }
    const duplicate = findByName(name, tag.id);
    if (duplicate) {
      setEditError(`"${duplicate.name}" already exists`);
      return;
    }
    updateMutation.mutate({ id: tag.id, name });
  };

  const handleEditBlur = (tag: TagUsage) => (e: FocusEvent<HTMLDivElement>) => {
    // Focus moving between the input and its own buttons isn't "clicking away".
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    commitEdit(tag, { fromBlur: true });
  };

  const header = (
    <div>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Tags</h1>
        {tags && tags.length > 0 && (
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{pluralize(tags.length, 'tag')}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Tags group related posts so readers can find more on a topic.
      </p>
    </div>
  );

  if (isLoading) return (
    <div className="space-y-6">
      {header}
      <div className="space-y-6 animate-pulse">
        {/* Skeleton input bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="h-10 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-full md:w-28 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Skeleton Tag Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex min-h-35 flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
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
    </div>
  );

  // Only a failed first load gets this; a failed background refetch keeps the
  // tags already on screen.
  if (isError && !tags) return (
    <div className="space-y-6">
      {header}
      <div role="alert" className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-red-200 bg-red-50/40 py-20 text-center dark:border-red-900/50 dark:bg-red-950/10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-red-100 dark:bg-zinc-800 dark:ring-red-900/50">
          <AlertTriangle size={26} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Couldn't load your tags</h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">Check your connection and try again.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="admin-btn admin-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}

      {/* ─── Find / add bar ─── */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full flex items-center relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} aria-hidden="true" />
            <input
              value={newTagName}
              onChange={(e) => { setNewTagName(e.target.value); setFormError(null); }}
              placeholder="Find or add a tag (e.g. React, Design)"
              aria-label="Find or add a tag"
              aria-invalid={!!formError}
              aria-describedby="tag-form-message"
              className={`w-full rounded-xl border bg-zinc-50 pl-11 pr-4 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-4 dark:bg-zinc-800 dark:text-white ${
                formError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10 dark:border-red-700'
                  : 'border-zinc-200 focus:border-violet-500 focus:ring-violet-500/10 dark:border-zinc-700 dark:focus:border-violet-500'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag();
                if (e.key === 'Escape') { setNewTagName(''); setFormError(null); }
              }}
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
            Add tag
          </button>
        </div>
        <div id="tag-form-message" aria-live="polite">
          {formError ? (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{formError}</p>
          ) : query && tags && tags.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Showing {visibleTags.length} of {pluralize(tags.length, 'tag')}
            </p>
          ) : null}
        </div>
      </div>

      {/* ─── Tag Grid ─── */}
      {tags && tags.length > 0 ? (
        visibleTags.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleTags.map(tag => (
              <div
                key={tag.id}
                className={`group relative flex min-h-35 flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border transition-all hover:shadow-md dark:bg-zinc-900 ${
                  highlightId === tag.id
                    ? 'border-violet-400 ring-4 ring-violet-500/15 dark:border-violet-600'
                    : 'border-zinc-200 hover:border-violet-200 dark:border-zinc-800 dark:hover:border-violet-900/50'
                }`}
              >
                {editingId === tag.id ? (
                  <div className="flex flex-col gap-2" onBlur={handleEditBlur(tag)}>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                      aria-label={`New name for ${tag.name}`}
                      aria-invalid={!!editError}
                      className={`w-full rounded-lg border bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:text-white ${
                        editError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
                          : 'border-zinc-200 focus:border-violet-500 focus:ring-violet-500/20 dark:border-zinc-700'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(tag);
                        if (e.key === 'Escape') stopEditing();
                      }}
                    />
                    <p className="min-h-4 text-xs font-medium text-red-600 dark:text-red-400" aria-live="polite">
                      {editError}
                    </p>
                    <div className="flex items-center gap-2">
                      {/* preventDefault on mousedown keeps focus in the input, so
                          clicking ✗ can't first trigger the save-on-blur. */}
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => commitEdit(tag)}
                        disabled={!editValue.trim() || updateMutation.isPending}
                        aria-label={`Save new name for ${tag.name}`}
                        className="flex-1 rounded-lg bg-emerald-100 py-1.5 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 flex justify-center transition-colors"
                      >
                        {updateMutation.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        ) : (
                          <Check size={16} />
                        )}
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={stopEditing}
                        aria-label="Cancel rename"
                        className="flex-1 rounded-lg bg-zinc-100 py-1.5 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 flex justify-center transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        <TagIcon size={18} />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(tag)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                          aria-label={`Rename ${tag.name}`}
                          title="Rename"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tag)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
                          aria-label={`Delete ${tag.name}`}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white line-clamp-1" title={tag.name}>
                        {tag.name}
                      </h3>
                      <p className={`mt-1 text-xs font-medium ${tag.post_count > 0 ? 'text-zinc-500' : 'text-zinc-400 italic dark:text-zinc-500'}`}>
                        {tag.post_count > 0 ? pluralize(tag.post_count, 'post') : 'Unused'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="text-sm text-zinc-500">
              No tags match <span className="font-semibold text-zinc-900 dark:text-white">"{newTagName.trim()}"</span>.
            </p>
            <button
              onClick={handleCreateTag}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={16} />
              Create "{newTagName.trim()}"
            </button>
          </div>
        )
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
        onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null); }}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        autoClose={false}
        isLoading={deleteMutation.isPending}
        title="Delete tag"
        confirmText="Delete tag"
        message={
          deleteTarget
            ? deleteTarget.post_count > 0
              ? `"${deleteTarget.name}" is used on ${pluralize(deleteTarget.post_count, 'post')}. Deleting it removes it from ${deleteTarget.post_count === 1 ? 'that post' : 'all of them'}. The posts themselves aren't affected.`
              : `"${deleteTarget.name}" isn't used on any posts.`
            : ''
        }
      />
    </div>
  );
};
