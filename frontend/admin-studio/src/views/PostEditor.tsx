import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import toast from 'react-hot-toast';
import { Save, Eye, Edit3, ArrowLeft, Loader2, ImageIcon, Link as LinkIcon, Upload } from 'lucide-react';
import SimpleMDE from "react-simplemde-editor";
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
      
      // Your backend returns { url: "https://cloudinary.com/..." }
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (10MB for Cloudinary)
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

  const editorOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: "Write your story in Markdown...",
    status: false,
    minHeight: "450px",
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
    ]
  }), [thumbnail]);

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
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={() => navigate('/admin/posts')} 
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition"
        >
          <ArrowLeft size={18} /> Back to Library
        </button>
        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={() => setIsPreview(!isPreview)} 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 transition"
          >
            {isPreview ? <><Edit3 size={16}/> Edit Mode</> : <><Eye size={16}/> Preview</>}
          </button>
          <button 
            onClick={handleSubmit(onSubmit)} 
            disabled={mutation.isPending || isUploading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
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
          className="w-full text-4xl font-extrabold border-none focus:ring-0 bg-transparent placeholder-gray-200" 
        />

        {/* Featured Thumbnail Section */}
        <div className="group relative flex items-center gap-4 p-4 bg-linear-to-r from-indigo-50 to-purple-50 rounded-2xl border border-dashed border-indigo-200 hover:border-indigo-300 transition-colors">
          <div className="relative h-24 w-36 bg-white rounded-xl overflow-hidden shrink-0 shadow-sm border border-indigo-100">
            {thumbnail ? (
              <img src={thumbnail} alt="Thumbnail" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <ImageIcon className="text-gray-300" size={28} />
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={24} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-indigo-600 tracking-widest mb-2">
              <LinkIcon size={10} /> Featured Thumbnail
            </label>
            <input 
              {...register('thumbnail_url')} 
              placeholder="Paste Cloudinary URL or upload below..." 
              className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder-indigo-300 mb-2 font-mono" 
            />
            <div className="flex gap-2">
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
                  className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Settings Bar */}
        <div className="flex gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" {...register('is_project')} className="rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" /> 
            <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition">Portfolio Project</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" {...register('published')} className="rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" /> 
            <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition">Live Visibility</span>
          </label>
        </div>

        {/* Upload Status */}
        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-4 py-3 rounded-lg border border-indigo-200">
            <Loader2 className="animate-spin" size={16} />
            <span className="font-medium">Uploading to Cloudinary...</span>
          </div>
        )}

        {/* Editor or Preview Area */}
        {isPreview ? (
          <div className="prose prose-indigo prose-lg dark:prose-invert max-w-none p-10 border rounded-2xl bg-white min-h-125 shadow-sm overflow-auto">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-4xl font-bold mb-6 mt-8 text-gray-900" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-3xl font-bold mb-5 mt-7 text-gray-900" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mb-4 mt-6 text-gray-900" {...props} />,
                p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 text-gray-700 space-y-2" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 text-gray-700 space-y-2" {...props} />,
                li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-gray-50 italic text-gray-700" {...props} />,
                code: ({ node, inline, ...props }) => 
                  inline ? (
                    <code className="bg-gray-200 px-2 py-1 rounded text-sm font-mono text-red-600" {...props} />
                  ) : (
                    <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4" {...props} />
                  ),
                pre: ({ node, ...props }) => <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto my-4" {...props} />,
                a: ({ node, ...props }) => <a className="text-indigo-600 hover:text-indigo-700 underline" {...props} />,
                img: ({ node, ...props }) => <img className="max-w-full h-auto rounded-lg my-4 shadow-md" {...props} />,
                table: ({ node, ...props }) => <table className="w-full border-collapse border border-gray-300 my-4" {...props} />,
                thead: ({ node, ...props }) => <thead className="bg-gray-100" {...props} />,
                th: ({ node, ...props }) => <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props} />,
                td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-2" {...props} />,
              }}
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