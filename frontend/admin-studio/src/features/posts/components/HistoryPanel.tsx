import React from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { History, Loader2, RotateCcw, X } from 'lucide-react';
import api from '../../../shared/api/client';
import { formatLocalDateTime } from '../../../shared/utils/dates';
import { markdownComponents } from './MarkdownConfig';

export interface RevisionSummary {
  id: number;
  title: string;
  reason: 'saved' | 'published' | 'restored' | string;
  created_at: string;
  saved_by_name: string | null;
  words: number;
}

export interface Revision extends RevisionSummary {
  content: string;
  thumbnail_url: string | null;
}

const REASON_LABEL: Record<string, string> = {
  saved: 'Saved',
  published: 'Published',
  restored: 'Restored',
};

/**
 * The post's saved versions, newest first. Picking one previews it;
 * "Restore this version" hands it to the editor to load — nothing goes live
 * until the author saves, and the version it replaces stays in the history.
 */
export const HistoryPanel = ({
  blogId,
  postId,
  onClose,
  onRestore,
}: {
  blogId: number;
  postId: string;
  onClose: () => void;
  onRestore: (revision: Revision) => void;
}) => {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { data: revisions, isLoading } = useQuery<RevisionSummary[]>({
    queryKey: ['postRevisions', blogId, postId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/posts/${postId}/revisions`)).data,
  });

  const { data: selected, isFetching } = useQuery<Revision>({
    queryKey: ['postRevision', blogId, postId, selectedId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/posts/${postId}/revisions/${selectedId}`)).data,
    enabled: selectedId !== null,
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // z-60 matches the studio's Modal: above the header and a fullscreen editor.
    <div className="fixed inset-0 z-[60] flex justify-end bg-zinc-950/45 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl dark:bg-zinc-900 md:flex-row"
      >
        <div className="flex max-h-[40vh] flex-col border-b border-zinc-200 md:max-h-none md:w-72 md:border-b-0 md:border-r dark:border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
              <History size={16} /> Version history
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="m-4 h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />}
            {revisions?.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                No saved versions yet. A version is kept each time you save a change.
              </p>
            )}
            <ul>
              {revisions?.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full border-l-2 px-4 py-2.5 text-left transition ${
                      selectedId === r.id
                        ? 'border-violet-600 bg-violet-50 dark:bg-violet-950/40'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatLocalDateTime(r.created_at)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {REASON_LABEL[r.reason] ?? r.reason}
                      {r.saved_by_name && ` · ${r.saved_by_name}`} · {r.words.toLocaleString()} words
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {selectedId === null ? (
            <p className="m-auto px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Pick a version to preview it.</p>
          ) : isFetching || !selected ? (
            <Loader2 className="m-auto animate-spin text-violet-600" size={28} />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <h1 className="mb-4 text-2xl font-extrabold text-zinc-900 dark:text-white">{selected.title}</h1>
                <div className="prose prose-zinc max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {selected.content}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-zinc-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Restoring loads this into the editor. Nothing changes until you save.</p>
                <button
                  type="button"
                  onClick={() => onRestore(selected)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  <RotateCcw size={15} /> Restore this version
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
