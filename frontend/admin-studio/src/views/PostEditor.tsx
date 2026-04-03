import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import toast from 'react-hot-toast';
import { Save, Eye, Edit3, ArrowLeft, Loader2, ImageIcon, Link as LinkIcon, Upload, Tag as TagIcon, X } from 'lucide-react';
import SimpleMDE from "react-simplemde-editor";
import type { Options } from 'easymde';
import "easymde/dist/easymde.min.css";
import "highlight.js/styles/atom-one-dark.css";
import api from '../api/client';

interface PostForm {
  title: string;
  content: string;
  thumbnail_url: string;
  is_project: boolean;
  published: boolean;
  tag_ids: number[];
}

export const PostEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;
  const [isPreview, setIsPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const { control, register, handleSubmit, reset, watch, setValue } = useForm<PostForm>({
    defaultValues: {
      is_project: false,
      published: true,
      tag_ids: [],
      thumbnail_url: ''
    }
  });

  const content = watch('content', '');
  const thumbnail = watch('thumbnail_url');
  const selectedTagIds = watch('tag_ids', []);

  // Fetch all available tags
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await api.get('/tags/');
      return response.data;
    }
  });

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/tags/', { name });
      return response.data;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      // Add the new tag to selected tags
      setValue('tag_ids', [...selectedTagIds, newTag.id]);
      setNewTagName('');
      toast.success(`Tag "${newTag.name}" created!`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create tag');
    }
  });

  // Handle tag selection
  const toggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      setValue('tag_ids', selectedTagIds.filter(id => id !== tagId));
    } else {
      setValue('tag_ids', [...selectedTagIds, tagId]);
    }
  };

  // Handle creating new tag
  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }
    
    // Check if tag already exists
    const existingTag = allTags.find(
      (tag: any) => tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    
    if (existingTag) {
      // Tag exists, just select it
      if (!selectedTagIds.includes(existingTag.id)) {
        setValue('tag_ids', [...selectedTagIds, existingTag.id]);
      }
      setNewTagName('');
      toast.success(`Tag "${existingTag.name}" selected!`);
    } else {
      // Create new tag
      createTagMutation.mutate(newTagName.trim());
    }
  };

  // Handle image upload for SimpleMDE
  const handleImageUpload = async (
    file: File,
    onSuccess: (url: string) => void,
    onError: (error: string) => void
  ) => {
    console.log('📤 Starting image upload:', file.name);
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('⬆️ Uploading to backend...');
      const response = await api.post('/posts/upload-image', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ Upload response:', response.data);
      
      const uploadedUrl = response.data.url;
      
      if (!uploadedUrl) {
        throw new Error('No URL in response');
      }
      
      onSuccess(uploadedUrl);
      toast.success('Image uploaded successfully!');

      // Auto-set first image as thumbnail if none exists
      if (!thumbnail) {
        setValue('thumbnail_url', uploadedUrl);
        toast.success('Set as featured thumbnail!');
      }
    } catch (error: any) {
      console.error('❌ Image upload error:', error);
      console.error('Response:', error.response?.data);
      
      const errorMsg = error.response?.data?.detail || error.message || 'Image upload failed';
      onError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle thumbnail file upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('🖼️ Thumbnail upload:', file.name);

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/posts/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const uploadedUrl = response.data.url;
      setValue('thumbnail_url', uploadedUrl);
      toast.success('Thumbnail uploaded!');
    } catch (error: any) {
      console.error('Thumbnail upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload thumbnail');
    } finally {
      setIsUploading(false);
    }
  };

  const editorOptions = useMemo<Options>(() => ({
    spellChecker: false,
    placeholder: "Write your story in Markdown...",
    status: false,
    minHeight: "450px",
    lineWrapping: true,
    uploadImage: true,
    imageUploadFunction: handleImageUpload,
    renderingConfig: {
      singleLineBreaks: false,
    },
    toolbar: [
      "bold", "italic", "heading", "|",
      "quote", "unordered-list", "ordered-list", "|",
      "link", "upload-image", "|",
      "preview", "side-by-side", "fullscreen", "|",
      "guide"
    ] as Options['toolbar']
  }), [thumbnail]);

  const markdownComponents: Components = {
    h1: ({ node, ...props }) => <h1 className="mb-6 mt-8 text-4xl font-bold text-slate-900 dark:text-white" {...props} />,
    h2: ({ node, ...props }) => <h2 className="mb-5 mt-7 text-3xl font-bold text-slate-900 dark:text-white" {...props} />,
    h3: ({ node, ...props }) => <h3 className="mb-4 mt-6 text-2xl font-bold text-slate-900 dark:text-white" {...props} />,
    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300" {...props} />,
    ul: ({ node, ...props }) => <ul className="mb-4 list-inside list-disc space-y-2 text-slate-700 dark:text-slate-300" {...props} />,
    ol: ({ node, ...props }) => <ol className="mb-4 list-inside list-decimal space-y-2 text-slate-700 dark:text-slate-300" {...props} />,
    li: ({ node, ...props }) => <li className="ml-4" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="my-4 border-l-4 border-indigo-500 bg-slate-50 py-2 pl-4 italic text-slate-700 dark:bg-slate-800/70 dark:text-slate-300" {...props} />,
    code: ({ node, className, ...props }) => (
      <code
        className={className?.includes('language-')
          ? "block overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-100"
          : "rounded bg-slate-200 px-2 py-1 font-mono text-sm text-red-600 dark:bg-slate-700 dark:text-red-300"}
        {...props}
      />
    ),
    pre: ({ node, ...props }) => <pre className="my-4 overflow-x-auto rounded-lg bg-slate-950 p-4" {...props} />,
    a: ({ node, ...props }) => <a className="text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300" {...props} />,
    img: ({ node, ...props }) => <img className="my-4 h-auto max-w-full rounded-lg shadow-md" {...props} />,
    table: ({ node, ...props }) => <table className="my-4 w-full border-collapse border border-slate-300 dark:border-slate-700" {...props} />,
    thead: ({ node, ...props }) => <thead className="bg-slate-100 dark:bg-slate-800" {...props} />,
    th: ({ node, ...props }) => <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900 dark:border-slate-700 dark:text-white" {...props} />,
    td: ({ node, ...props }) => <td className="border border-slate-300 px-4 py-2 text-slate-700 dark:border-slate-700 dark:text-slate-300" {...props} />,
  };

  const { data: existingPost, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => (await api.get(`/posts/${id}`)).data,
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingPost) {
      reset({
        ...existingPost,
        tag_ids: existingPost.tags?.map((t: any) => t.id) || []
      });
    }
  }, [existingPost, reset]);

  const mutation = useMutation({
    mutationFn: (data: PostForm) => 
      isEditMode ? api.patch(`/posts/${id}`, data) : api.post('/posts/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] });
      toast.success(isEditMode ? 'Changes saved!' : 'Post published!');
      navigate('/admin/posts');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to save post';
      toast.error(errorMsg);
    }
  });

  const onSubmit = (data: PostForm) => {
    console.log('📝 Submitting post:', data);
    mutation.mutate(data);
  };

  if (isEditMode && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="admin-page mx-auto max-w-5xl px-4 py-4 sm:p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button 
          onClick={() => navigate('/admin/posts')} 
          className="inline-flex items-center gap-2 text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={18} /> Back to Library
        </button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button 
            type="button" 
            onClick={() => setIsPreview(!isPreview)} 
            className="admin-card flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
          >
            {isPreview ? <><Edit3 size={16}/> Edit Mode</> : <><Eye size={16}/> Preview</>}
          </button>
          <button 
            onClick={handleSubmit(onSubmit)} 
            disabled={mutation.isPending || isUploading}
            className="admin-btn admin-btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2 disabled:opacity-50 sm:w-auto"
          >
            <Save size={16} /> 
            {mutation.isPending ? 'Saving...' : isEditMode ? 'Update Post' : 'Publish Now'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Title Input */}
        <input 
          {...register('title', { required: true })} 
          placeholder="Enter a catchy title..." 
          className="w-full border-none bg-transparent text-3xl font-extrabold text-slate-900 placeholder:text-slate-400 focus:ring-0 dark:text-white dark:placeholder:text-slate-500 sm:text-4xl" 
        />

        {/* Featured Thumbnail Section */}
        <div className="group relative flex flex-col items-start gap-4 rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 transition-colors hover:border-indigo-300 dark:border-indigo-500/30 dark:from-indigo-950/40 dark:to-slate-900 dark:hover:border-indigo-400/50 sm:flex-row sm:items-center">
          <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {thumbnail ? (
              <img src={thumbnail} alt="Thumbnail" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <ImageIcon className="text-slate-300 dark:text-slate-500" size={28} />
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={24} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 self-stretch">
            <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              <LinkIcon size={10} /> Featured Thumbnail
            </label>
            <input 
              {...register('thumbnail_url')} 
              placeholder="Paste Cloudinary URL or upload below..." 
              className="mb-2 w-full bg-transparent font-mono text-sm text-slate-700 outline-none placeholder:text-indigo-300 dark:text-slate-200 dark:placeholder:text-indigo-400/70" 
            />
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition">
                  <Upload size={12} /> {isUploading ? 'Uploading...' : 'Upload Image'}
                </span>
              </label>
              {thumbnail && (
                <button
                  type="button"
                  onClick={() => setValue('thumbnail_url', '')}
                  className="rounded px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-200 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tags Section - NEW! */}
        <div className="admin-section space-y-4 rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <TagIcon size={18} className="text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tags</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">({selectedTagIds.length} selected)</span>
          </div>

          {/* Selected Tags */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedTagIds.map(tagId => {
                const tag = allTags.find((t: any) => t.id === tagId);
                if (!tag) return null;
                return (
                  <button
                    key={tagId}
                    type="button"
                    onClick={() => toggleTag(tagId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 transition-all"
                  >
                    {tag.name}
                    <X size={14} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Available Tags */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Available Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {allTags
                .filter((tag: any) => !selectedTagIds.includes(tag.id))
                .map((tag: any) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-indigo-100 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300"
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Create New Tag */}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Create New Tag
            </p>
            <form onSubmit={handleCreateTag} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name..."
                className="admin-input flex-1 px-4 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={createTagMutation.isPending || !newTagName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTagMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
        
        {/* Settings Bar */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" {...register('is_project')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900" /> 
            <span className="text-sm font-medium text-slate-700 transition group-hover:text-indigo-600 dark:text-slate-300 dark:group-hover:text-indigo-300">Portfolio Project</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" {...register('published')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900" /> 
            <span className="text-sm font-medium text-slate-700 transition group-hover:text-indigo-600 dark:text-slate-300 dark:group-hover:text-indigo-300">Live Visibility</span>
          </label>
          </div>
        </div>

        {/* Upload Status */}
        {isUploading && (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Loader2 className="animate-spin" size={16} />
            <span className="font-medium">Uploading to Cloudinary...</span>
          </div>
        )}

        {/* Editor or Preview Area */}
        {isPreview ? (
          <div className="prose prose-indigo dark:prose-invert max-w-none overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-h-[500px] sm:p-8 lg:p-10 dark:border-slate-700 dark:bg-slate-900">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {content || "*Your content preview will appear here...*"}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="editor-container">
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <SimpleMDE {...field} options={editorOptions} />
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};
