import React, { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import SimpleMDE from 'react-simplemde-editor';
import { Eye, Edit3, ArrowLeft, Loader2, ImageIcon, Link as LinkIcon, Upload, Layout, FileText } from 'lucide-react';

import { usePostEditor } from '../hooks/usePostEditor';
import { TagSelector } from '../components/TagSelector';
import { markdownComponents, getEditorOptions } from '../components/MarkdownConfig';
import { SchedulePublishPanel } from '../components/SchedulePublishPanel';
import { ContentBlueprint } from '../components/ContentBlueprint';

import 'easymde/dist/easymde.min.css';
import 'highlight.js/styles/atom-one-dark.css';

export const PostEditor: React.FC = () => {
  const {
    control, register, setValue, isEditMode, isPreview, setIsPreview, isUploading,
    tagSearch, setTagSearch, content, thumbnail, selectedTagIds, currentStatus,
    currentPubAt, isProject, allTags, filteredAvailableTags, exactMatchExists,
    createTagMutation, toggleTag, handleCreateTagSubmit, handleImageUpload,
    handleThumbnailUpload, isLoading, mutation, saveWithStatus, navigate
  } = usePostEditor();

  const editorOptions = useMemo(() => getEditorOptions(handleImageUpload), [handleImageUpload]);

  if (isEditMode && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={40} />
      </div>
    );
  }

  return (
    <div className="admin-page mx-auto max-w-6xl px-4 py-4 sm:p-6">
      {/* Top action bar */}
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
          {isPreview ? <><Edit3 size={16} /> Edit</> : <><Eye size={16} /> Preview</>}
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Main Canvas Column */}
        <div className="min-w-0 flex-1 space-y-6">
          <input
            {...register("title", { required: true })}
            placeholder="Give your post a title…"
            className="w-full border-none bg-transparent text-3xl font-extrabold text-zinc-900 placeholder:text-zinc-300 focus:ring-0 dark:text-white dark:placeholder:text-zinc-600 sm:text-4xl"
          />

          {/* Post Type Selector Switch */}
          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 w-fit">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-2">Post Type</span>
            <div className="flex bg-zinc-200/70 dark:bg-zinc-800 rounded-lg p-0.5 relative">
              <button
                type="button"
                onClick={() => setValue("is_project", false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  !isProject ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <FileText size={14} /> Standard Article
              </button>
              <button
                type="button"
                onClick={() => setValue("is_project", true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isProject ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <Layout size={14} /> Showcase Project
              </button>
            </div>
          </div>

          {/* Featured Image Block */}
          <div className="group flex flex-col items-start gap-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/40 sm:flex-row sm:items-center">
            <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              {thumbnail ? (
                <img src={thumbnail} alt="Thumbnail" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="text-zinc-300 dark:text-zinc-600" size={28} />
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
                  <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={isUploading} />
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

          {/* Main Editor Component Canvas */}
          {isPreview ? (
            <div className="prose prose-zinc dark:prose-invert max-w-none overflow-auto rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm min-h-[500px] dark:border-zinc-700 dark:bg-zinc-900">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                {content || "*Your content preview will appear here…*"}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="editor-container">
              <Controller name="content" control={control} render={({ field }) => <SimpleMDE {...field} options={editorOptions} />} />
            </div>
          )}
        </div>

        {/* Sidebar Management Panel Column */}
        <div className="w-full lg:w-72 lg:flex-shrink-0 space-y-6">
          <SchedulePublishPanel
            status={currentStatus}
            publishedAt={currentPubAt}
            isSaving={mutation.isPending}
            onSaveDraft={() => saveWithStatus('draft')}
            onPublishNow={() => saveWithStatus('published')}
            onSchedule={(at) => saveWithStatus('scheduled', at)}
            onUnpublish={() => saveWithStatus('draft', null)}
          />

          <TagSelector
            selectedTagIds={selectedTagIds}
            allTags={allTags}
            filteredAvailableTags={filteredAvailableTags}
            tagSearch={tagSearch}
            exactMatchExists={exactMatchExists}
            isTagPending={createTagMutation.isPending}
            setTagSearch={setTagSearch}
            toggleTag={toggleTag}
            onCreateTag={handleCreateTagSubmit}
          />

          <ContentBlueprint isProject={isProject} />
        </div>
      </div>
    </div>
  );
};