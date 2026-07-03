import React from 'react';
import { Tag as TagIcon, X, Search, Plus } from 'lucide-react';

interface TagSelectorProps {
  selectedTagIds: number[];
  allTags: any[];
  filteredAvailableTags: any[];
  tagSearch: string;
  exactMatchExists: boolean;
  isTagPending: boolean;
  setTagSearch: (val: string) => void;
  toggleTag: (id: number) => void;
  onCreateTag: (e: React.FormEvent) => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTagIds, allTags, filteredAvailableTags, tagSearch,
  exactMatchExists, isTagPending, setTagSearch, toggleTag, onCreateTag
}) => {
  return (
    <div className="admin-section space-y-4 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center gap-2">
        <TagIcon size={16} className="text-zinc-500" />
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Tags</h3>
        <span className="text-xs text-zinc-400">({selectedTagIds.length})</span>
      </div>

      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          {selectedTagIds.map((tagId) => {
            const tag = allTags.find((t: any) => t.id === tagId);
            if (!tag) return null;
            return (
              <button
                key={tagId}
                type="button"
                onClick={() => toggleTag(tagId)}
                className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover transition-all"
              >
                {tag.name} <X size={11} />
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="relative flex items-center w-full">
          <div className="absolute left-3 flex items-center pointer-events-none">
            <Search size={14} className="text-zinc-400 dark:text-zinc-500" />
          </div>
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Search or add tags..."
            className="w-full rounded-xl border border-zinc-200 bg-transparent py-2 pl-9 pr-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-0 dark:border-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600"
          />
        </div>

        {tagSearch.trim() !== '' && (
          <div className="border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-1 max-h-32 overflow-y-auto space-y-0.5 shadow-inner">
            {filteredAvailableTags.map((tag: any) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => { toggleTag(tag.id); setTagSearch(''); }}
                className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition"
              >
                {tag.name}
              </button>
            ))}

            {!exactMatchExists && (
              <button
                type="button"
                onClick={onCreateTag}
                disabled={isTagPending}
                className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 dark:hover:bg-primary/10 flex items-center gap-1 transition"
              >
                <Plus size={12} /> Create "{tagSearch.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};