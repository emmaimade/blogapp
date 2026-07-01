import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import toast from 'react-hot-toast';
import {
  Eye, Edit3, ArrowLeft, Loader2, ImageIcon,
  Link as LinkIcon, Upload, Tag as TagIcon, X, FolderOpen,
} from 'lucide-react';
import SimpleMDE from 'react-simplemde-editor';
import type { Options } from 'easymde';
import 'easymde/dist/easymde.min.css';
import 'highlight.js/styles/atom-one-dark.css';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { SchedulePublishPanel } from '../components/SchedulePublishPanel';
import { MarkdownGuide } from '../components/MarkdownGuide';

type PostStatus = 'draft' | 'scheduled' | 'published';

interface PostForm {
  title: string;
  content: string;
  thumbnail_url: string;
  is_project: boolean;
  status: PostStatus;
  published_at: string | null;
  tag_ids: number[];
}

// ── Shared markdown components (reused in preview) ────────────────────────────
const markdownComponents: Components = {
  h1: ({ node, ...props }) => <h1 className="mb-6 mt-8 text-4xl font-bold text-zinc-900 dark:text-white" {...props} />,
  h2: ({ node, ...props }) => <h2 className="mb-5 mt-7 text-3xl font-bold text-zinc-900 dark:text-white" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mb-4 mt-6 text-2xl font-bold text-zinc-900 dark:text-white" {...props} />,
  p:  ({ node, ...props }) => <p className="mb-4 leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-4 list-inside list-disc space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-4 list-inside list-decimal space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />,
  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
  blockquote: ({ node, ...props }) => <blockquote className="my-4 border-l-4 border-zinc-300 bg-zinc-50 py-2 pl-4 italic text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300" {...props} />,
  code: ({ node, className, ...props }) => (
    <code
      className={className?.includes('language-')
        ? 'block overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-100'
        : 'rounded bg-zinc-200 px-2 py-1 font-mono text-sm text-red-600 dark:bg-zinc-700 dark:text-red-300'}
      {...props}
    />
  ),
  pre:   ({ node, ...props }) => <pre className="my-4 overflow-x-auto rounded-lg bg-zinc-950 p-4" {...props} />,
  a:     ({ node, ...props }) => <a className="text-violet-600 underline hover:text-violet-700 dark:text-violet-400" {...props} />,
  img:   ({ node, ...props }) => <img className="my-4 h-auto max-w-full rounded-lg shadow-md" {...props} />,
  table: ({ node, ...props }) => <table className="my-4 w-full border-collapse border border-zinc-300 dark:border-zinc-700" {...props} />,
  thead: ({ node, ...props }) => <thead className="bg-zinc-100 dark:bg-zinc-800" {...props} />,
  th:    ({ node, ...props }) => <th className="border border-zinc-300 px-4 py-2 text-left font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white" {...props} />,
  td:    ({ node, ...props }) => <td className="border border-zinc-300 px-4 py-2 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300" {...props} />,
};

// ── Component ─────────────────────────────────────────────────────────────────
export const PostEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeBlog } = useBlog();
  const isEditMode = !!id;

  const [isPreview, setIsPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const { control, register, handleSubmit, reset, watch, setValue } = useForm<PostForm>({
    defaultValues: {
      is_project: false,
      status: 'draft',
      published_at: null,
      tag_ids: [],
      thumbnail_url: '',
    },
  });

  const content         = watch('content', '');
  const thumbnail       = watch('thumbnail_url');
  const selectedTagIds  = watch('tag_ids', []);
  const currentStatus   = watch('status');
  const currentPubAt    = watch('published_at');

  // ── Tags ──────────────────────────────────────────────────────────────────
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags', activeBlog?.id],
    queryFn: async () => (await api.get(`/blogs/${activeBlog!.id}/tags/`)).data,
    enabled: !!activeBlog?.id,
  });

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => (await api.post(`/blogs/${activeBlog!.id}/tags/`, { name })).data,
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags', activeBlog?.id] });
      setValue('tag_ids', [...selectedTagIds, newTag.id]);
      setNewTagName('');
      toast.success(`Tag "${newTag.name}" created`);
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create tag'),
  });

  const toggleTag = (tagId: number) => {
    setValue('tag_ids', selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((i) => i !== tagId)
      : [...selectedTagIds, tagId]);
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    const existing = allTags.find((t: any) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) setValue('tag_ids', [...selectedTagIds, existing.id]);
      setNewTagName('');
      toast.success(`Tag "${existing.name}" selected`);
    } else {
      createTagMutation.mutate(newTagName.trim());
    }
  };

  // ── Image upload ──────────────────────────────────────────────────────────
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

  // ── Editor options ────────────────────────────────────────────────────────
  const editorOptions = useMemo<Options>(() => ({
    spellChecker: false,
    placeholder: 'Write your story in Markdown…',
    status: false,
    minHeight: '450px',
    lineWrapping: true,
    uploadImage: true,
    imageUploadFunction: handleImageUpload,
    renderingConfig: { singleLineBreaks: false },
    toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'upload-image', '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'] as Options['toolbar'],
  }), [thumbnail]);

  // ── Load existing post ────────────────────────────────────────────────────
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

  // ── Save mutation ─────────────────────────────────────────────────────────
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

  // ── Publish panel handlers ────────────────────────────────────────────────
  const saveWithStatus = (status: PostStatus, publishedAt?: Date | null) => {
    handleSubmit((data) => {
      mutation.mutate({
        ...data,
        status,
        published_at: publishedAt ? publishedAt.toISOString() : null,
      });
    })();
  };

  const handleSaveDraft    = () => saveWithStatus('draft');
  const handlePublishNow   = () => saveWithStatus('published');
  const handleSchedule     = (at: Date) => saveWithStatus('scheduled', at);
  const handleUnpublish    = () => saveWithStatus('draft', null);

  if (isEditMode && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={40} />
      </div>
    );
  }

  return (
    <div className="admin-page mx-auto max-w-6xl px-4 py-4 sm:p-6">
      {/* ─── Top bar ─── */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/admin/posts")}
          className="inline-flex items-center gap-2 text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft size={18} /> Back to Library
        </button>
        <button
          type="button"
          onClick={() => setIsPreview(!isPreview)}
          className="admin-card flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isPreview ? (
            <>
              <Edit3 size={16} /> Edit
            </>
          ) : (
            <>
              <Eye size={16} /> Preview
            </>
          )}
        </button>
      </div>

      {/* ─── Two-column layout ─── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Left: editor ── */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Title */}
          <input
            {...register("title", { required: true })}
            placeholder="Give your post a title…"
            className="w-full border-none bg-transparent text-3xl font-extrabold text-zinc-900 placeholder:text-zinc-300 focus:ring-0 dark:text-white dark:placeholder:text-zinc-600 sm:text-4xl"
          />

          {/* Thumbnail */}
          <div className="group flex flex-col items-start gap-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/40 sm:flex-row sm:items-center">
            <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt="Thumbnail"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon
                    className="text-zinc-300 dark:text-zinc-600"
                    size={28}
                  />
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="animate-spin text-white" size={24} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                <LinkIcon size={10} /> Featured Thumbnail
              </label>
              <input
                {...register("thumbnail_url")}
                placeholder="Paste image URL or upload…"
                className="mb-2 w-full bg-transparent font-mono text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-300"
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
                  <span className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 bg-primary text-white text-xs font-medium hover:bg-primary-hover transition">
                    <Upload size={12} /> {isUploading ? "Uploading…" : "Upload"}
                  </span>
                </label>
                {thumbnail && (
                  <button
                    type="button"
                    onClick={() => setValue("thumbnail_url", "")}
                    className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:text-red-400 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Upload status */}
          {isUploading && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900">
              <Loader2 className="animate-spin" size={16} />
              Uploading to Cloudinary…
            </div>
          )}

          {/* Editor / Preview */}
          {isPreview ? (
            <div className="prose prose-zinc dark:prose-invert max-w-none overflow-auto rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm min-h-[500px] dark:border-zinc-700 dark:bg-zinc-900">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {content || "*Your content preview will appear here…*"}
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

          {/* Tags */}
          <div className="admin-section space-y-4 rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <TagIcon size={16} className="text-zinc-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Tags
              </h3>
              <span className="text-xs text-zinc-400">
                ({selectedTagIds.length} selected)
              </span>
            </div>

            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTagIds.map((tagId) => {
                  const tag = allTags.find((t: any) => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <button
                      key={tagId}
                      type="button"
                      onClick={() => toggleTag(tagId)}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover transition-all"
                    >
                      {tag.name} <X size={13} />
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Available
              </p>
              <div className="flex flex-wrap gap-2">
                {allTags
                  .filter((tag: any) => !selectedTagIds.includes(tag.id))
                  .map((tag: any) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all"
                    >
                      {tag.name}
                    </button>
                  ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Create new tag
              </p>
              <form
                onSubmit={handleCreateTag}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name…"
                  className="admin-input flex-1 px-4 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={createTagMutation.isPending || !newTagName.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-all"
                >
                  {createTagMutation.isPending ? "Creating…" : "Create"}
                </button>
              </form>
            </div>
          </div>

          {/* Portfolio toggle */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("is_project")}
                className="rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-600 dark:bg-zinc-900"
              />
              <div>
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Portfolio project
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Mark as a project post for portfolio-style listing pages
                </p>
              </div>
              <FolderOpen size={16} className="ml-auto text-zinc-400" />
            </label>
          </div>
        </div>

        {/* ── Right sidebar: Publish panel ── */}
        <div className="w-full lg:w-72 lg:flex-shrink-0 space-y-6">
          <SchedulePublishPanel
            status={currentStatus}
            publishedAt={currentPubAt}
            isSaving={mutation.isPending}
            onSaveDraft={handleSaveDraft}
            onPublishNow={handlePublishNow}
            onSchedule={handleSchedule}
            onUnpublish={handleUnpublish}
          />

          {/* Markdown Guide */}
          <MarkdownGuide />
        </div>
      </div>
    </div>
  );
};