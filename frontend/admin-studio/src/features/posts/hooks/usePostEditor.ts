import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { LEAVE_AFTER_SAVE } from '../../../shared/hooks/useUnsavedChangesGuard';
import type { ScheduledPostSummary } from '../components/ScheduleCalendar';

export type PostStatus = 'draft' | 'scheduled' | 'published';

export interface PostForm {
  title: string;
  content: string;
  thumbnail_url: string;
  is_project: boolean;
  is_featured: boolean;
  status: PostStatus;
  published_at: string | null;
  tag_ids: number[];
}

export const usePostEditor = () => {
  const toWorkspace = useWorkspacePath();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const isEditMode = !!id;

  const [isPreview, setIsPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const { control, register, handleSubmit, reset, watch, setValue, getValues, formState: { isDirty, errors } } = useForm<PostForm>({
    defaultValues: {
      is_project: false,
      is_featured: false,
      status: 'draft',
      published_at: null,
      tag_ids: [],
      thumbnail_url: '',
    },
  });

  const content = watch('content', '');
  const thumbnail = watch('thumbnail_url');
  const selectedTagIds = watch('tag_ids', []);
  const currentStatus = watch('status');
  const currentPubAt = watch('published_at');
  const isProject = watch('is_project', false);
  const isFeatured = watch('is_featured', false);

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/tags/`)).data,
    enabled: !!activeBlog?.id,
  });

  const filteredAvailableTags = useMemo(() => {
    return allTags.filter((tag: any) => {
      const matchesSearch = tag.name.toLowerCase().includes(tagSearch.toLowerCase().trim());
      const isNotSelected = !selectedTagIds.includes(tag.id);
      return matchesSearch && isNotSelected;
    });
  }, [allTags, tagSearch, selectedTagIds]);

  const exactMatchExists = useMemo(() => {
    return allTags.some((t: any) => t.name.toLowerCase() === tagSearch.trim().toLowerCase());
  }, [allTags, tagSearch]);

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => (await api.post(`/blogs/${activeBlog!.id}/tags/`, { name })).data,
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags', activeBlog?.id] });
      setValue('tag_ids', [...selectedTagIds, newTag.id]);
      setTagSearch('');
      toast.success(`Tag "${newTag.name}" created`);
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create tag'),
  });

  const toggleTag = (tagId: number) => {
    setValue('tag_ids', selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((i) => i !== tagId)
      : [...selectedTagIds, tagId]);
  };

  const handleCreateTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagSearch.trim()) return;
    
    const existing = allTags.find((t: any) => t.name.toLowerCase() === tagSearch.trim().toLowerCase());
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) setValue('tag_ids', [...selectedTagIds, existing.id]);
      setTagSearch('');
    } else {
      createTagMutation.mutate(tagSearch.trim());
    }
  };

  // Stable across renders: the editor's options are built from it, and new
  // options make EasyMDE tear down and rebuild the whole editor.
  const blogId = activeBlog?.id;
  const handleImageUpload = useCallback(async (file: File, onSuccess: (url: string) => void, onError: (err: string) => void) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/blogs/${blogId}/posts/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      if (!url) throw new Error('No URL in response');
      onSuccess(url);
      toast.success('Image uploaded');
      if (!getValues('thumbnail_url')) { setValue('thumbnail_url', url); toast.success('Set as featured thumbnail'); }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Image upload failed';
      onError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }, [blogId, getValues, setValue]);

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be less than 10MB'); return; }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/blogs/${activeBlog!.id}/posts/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValue('thumbnail_url', res.data.url);
      toast.success('Thumbnail uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload thumbnail');
    } finally {
      setIsUploading(false);
    }
  };

  // The blog's other scheduled posts, marked on the scheduling calendar.
  const { data: scheduledPosts = [] } = useQuery({
    queryKey: ['scheduledPosts', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/posts/scheduled`)).data,
    enabled: !!activeBlog?.id,
    select: (posts: ScheduledPostSummary[]) => posts.filter((p) => String(p.id) !== id),
  });

  const { data: existingPost, isLoading } = useQuery({
    queryKey: ['post', id, activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/posts/${id}`)).data,
    enabled: isEditMode && !!activeBlog?.id,
  });

  useEffect(() => {
    if (existingPost) {
      reset({
        ...existingPost,
        status: existingPost.status ?? (existingPost.published ? 'published' : 'draft'),
        published_at: existingPost.published_at ?? null,
        tag_ids: existingPost.tags?.map((t: any) => t.id) ?? [],
      });
    }
  }, [existingPost, reset]);

  const mutation = useMutation({
    mutationFn: (data: PostForm) =>
      isEditMode
        ? api.patch(`/blogs/${activeBlog!.id}/posts/${id}`, data)
        : api.post(`/blogs/${activeBlog!.id}/posts/`, data),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminPosts', activeBlog?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledPosts', activeBlog?.id] });
      const msg = variables.status === 'scheduled'
        ? 'Post scheduled!'
        : variables.status === 'published'
        ? (isEditMode ? 'Changes published!' : 'Post published!')
        : 'Draft saved!';
      toast.success(msg);
      // Stay in the editor. Seeding the post query re-runs the reset effect
      // above, so the form takes the saved values and is no longer dirty.
      const saved = res.data;
      queryClient.setQueryData(['post', String(saved.id), activeBlog?.id], saved);
      if (!isEditMode) {
        // A new post moves to its edit URL so later saves update it rather
        // than creating another. The form still reads as dirty for this navigation.
        navigate(toWorkspace(`/posts/edit/${saved.id}`), { replace: true, state: LEAVE_AFTER_SAVE });
      }
    },
    onError: (error: any) => toastApiError(error, 'Failed to save post'),
  });

  const saveWithStatus = (status: PostStatus, publishedAt?: Date | null) => {
    handleSubmit((data) => {
      mutation.mutate({
        ...data,
        status,
        published_at: publishedAt ? publishedAt.toISOString() : null,
      });
    })();
  };

  // Saves without changing what readers see: a draft stays a draft, a
  // scheduled post keeps its time, a published post is updated in place.
  // Never publishes — that stays a deliberate click in the Publish panel.
  const quickSave = () => {
    if (currentStatus === 'scheduled' && currentPubAt) {
      saveWithStatus('scheduled', new Date(currentPubAt));
    } else {
      saveWithStatus(currentStatus === 'published' ? 'published' : 'draft');
    }
  };

  return {
    control, register, setValue, isEditMode, isPreview, setIsPreview, isUploading,
    tagSearch, setTagSearch, content, thumbnail, selectedTagIds, currentStatus,
    currentPubAt, isProject, isFeatured, allTags, filteredAvailableTags, exactMatchExists,
    createTagMutation, toggleTag, handleCreateTagSubmit, handleImageUpload,
    handleThumbnailUpload, isLoading, mutation, saveWithStatus, quickSave, navigate,
    isDirty, errors, scheduledPosts, savedTitle: existingPost?.title as string | undefined,
    editedAt: existingPost?.edited_at as string | null | undefined,
  };
};