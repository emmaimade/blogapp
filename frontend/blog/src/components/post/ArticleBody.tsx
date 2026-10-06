import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';

// react-markdown passes its hast `node` to every override; it must not
// reach the DOM element as an attribute.
const withoutNode = <T extends { node?: unknown }>(props: T): Omit<T, 'node'> => {
  const { node, ...rest } = props;
  void node;
  return rest;
};

// Typography comes from `prose` alone — these overrides only cover what
// prose can't: demoting an author's `#` (the post title is the page's one
// <h1>), inline-vs-block code, lazy images, and horizontally scrolling tables.
const markdownComponents: Components = {
  h1: (props) => <h2 {...withoutNode(props)} />,
  code: (codeProps) => {
    const { className, children, ...props } = withoutNode(codeProps);
    const isBlock = Boolean(className) || String(children).includes('\n');
    if (isBlock) {
      // The highlight.js theme gives `.hljs` its own background and padding;
      // the <pre> already provides both, so drop them to avoid a box-in-a-box.
      return <code className={`${className ?? ''} bg-transparent! p-0!`.trim()} {...props}>{children}</code>;
    }
    return (
      <code
        className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.9em] font-normal text-rose-600 dark:bg-zinc-800 dark:text-rose-400"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre className="scroll-shadows [--scroll-shadow-bg:#18181b] dark:border dark:border-zinc-800" {...withoutNode(props)} />
  ),
  img: (props) => <img loading="lazy" decoding="async" {...withoutNode(props)} />,
  table: (props) => (
    <div className="overflow-x-auto scroll-shadows dark:[--scroll-shadow-bg:#09090b]">
      <table {...withoutNode(props)} />
    </div>
  ),
};

interface ArticleBodyProps {
  content: string;
  ref?: React.Ref<HTMLElement>;
}

export const ArticleBody: React.FC<ArticleBodyProps> = ({ content, ref }) => (
  <article
    ref={ref}
    className="prose prose-zinc dark:prose-invert lg:prose-lg max-w-none
      prose-headings:font-bold prose-headings:tracking-tight prose-headings:scroll-mt-24
      prose-a:text-primary prose-a:underline-offset-2 prose-a:decoration-primary/40 hover:prose-a:decoration-primary
      dark:prose-a:text-zinc-50 dark:prose-a:decoration-primary
      prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-zinc-900 prose-img:rounded-2xl prose-img:shadow-md"
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  </article>
);
