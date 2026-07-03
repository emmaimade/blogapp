import { type Components } from 'react-markdown';
import type { Options } from 'easymde';

export const markdownComponents: Components = {
  h1: (props) => <h1 className="mb-6 mt-8 text-4xl font-bold text-zinc-900 dark:text-white" {...props} />,
  h2: (props) => <h2 className="mb-5 mt-7 text-3xl font-bold text-zinc-900 dark:text-white" {...props} />,
  h3: (props) => <h3 className="mb-4 mt-6 text-2xl font-bold text-zinc-900 dark:text-white" {...props} />,
  p:  (props) => <p className="mb-4 leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />,
  ul: (props) => <ul className="mb-4 list-inside list-disc space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />,
  ol: (props) => <ol className="mb-4 list-inside list-decimal space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />,
  li: (props) => <li className="ml-4" {...props} />,
  blockquote: (props) => <blockquote className="my-4 border-l-4 border-zinc-300 bg-zinc-50 py-2 pl-4 italic text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300" {...props} />,
  code: ({ className, ...props }) => (
    <code
      className={className?.includes('language-')
        ? 'block overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-100'
        : 'rounded bg-zinc-200 px-2 py-1 font-mono text-sm text-red-600 dark:bg-zinc-700 dark:text-red-300'}
      {...props}
    />
  ),
  pre:   (props) => <pre className="my-4 overflow-x-auto rounded-lg bg-zinc-950 p-4" {...props} />,
  a:     (props) => <a className="text-violet-600 underline hover:text-violet-700 dark:text-violet-400" {...props} />,
  img:   (props) => <img className="my-4 h-auto max-w-full rounded-lg shadow-md" {...props} />,
  table: (props) => <table className="my-4 w-full border-collapse border border-zinc-300 dark:border-zinc-700" {...props} />,
  thead: (props) => <thead className="bg-zinc-100 dark:bg-zinc-800" {...props} />,
  th:    (props) => <th className="border border-zinc-300 px-4 py-2 text-left font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white" {...props} />,
  td:    (props) => <td className="border border-zinc-300 px-4 py-2 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300" {...props} />,
};

export const getEditorOptions = (imageUploadFn: any): Options => ({
  spellChecker: false,
  placeholder: 'Write your story in Markdown…',
  status: false,
  minHeight: '450px',
  lineWrapping: true,
  uploadImage: true,
  imageUploadFunction: imageUploadFn,
  renderingConfig: { singleLineBreaks: false },
  toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'upload-image', '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'] as Options['toolbar'],
});