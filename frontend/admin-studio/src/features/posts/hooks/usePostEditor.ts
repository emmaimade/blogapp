import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';

export type PostStatus = 'draft' | 'scheduled' | 'published';

export interface PostForm {
  title: string;
  content: string;
  thumbnail_url: string;
  is_project: boolean;
  status: PostStatus;
  published_at: string | null;
  tag_ids: number[];
}

export const usePostEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const isEditMode = !!id;

  const [isPreview, setIsPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const { control, register, handleSubmit, reset, watch, setValue } = useForm<PostForm>({
    defaultValues: {
      is_project: false,
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

  const handleImageUpload = async (file: File, onSuccess: (url: string) => void, onError: (err: string) => void) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/blogs/${activeBlog!.id}/posts/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      if (!url) throw new Error('No URL in response');
      onSuccess(url);
      toast.success('Image uploaded');
      if (!thumbnail) { setValue('thumbnail_url', url); toast.success('Set as featured thumbnail'); }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Image upload failed';
      onError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminPosts', activeBlog?.id] });
      const msg = variables.status === 'scheduled'
        ? 'Post scheduled!'
        : variables.status === 'published'
        ? (isEditMode ? 'Changes published!' : 'Post published!')
        : 'Draft saved!';
      toast.success(msg);
      navigate('/admin/posts');
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to save post'),
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

  return {
    control, register, setValue, isEditMode, isPreview, setIsPreview, isUploading,
    tagSearch, setTagSearch, content, thumbnail, selectedTagIds, currentStatus,
    currentPubAt, isProject, allTags, filteredAvailableTags, exactMatchExists,
    createTagMutation, toggleTag, handleCreateTagSubmit, handleImageUpload,
    handleThumbnailUpload, isLoading, mutation, saveWithStatus, navigate
  };
};