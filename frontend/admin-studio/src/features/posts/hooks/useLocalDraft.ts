import { useCallback, useEffect, useState } from 'react';

export interface DraftValues {
  title: string;
  content: string;
  thumbnail_url: string;
  tag_ids: number[];
}

interface StoredDraft {
  savedAt: number; // ms since epoch
  values: DraftValues;
}

const AUTOSAVE_DELAY_MS = 2000;

const read = (key: string): StoredDraft | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
};

const differs = (a: DraftValues, b: DraftValues) =>
  a.title !== b.title || a.content !== b.content || a.thumbnail_url !== b.thumbnail_url ||
  [...a.tag_ids].sort().join(',') !== [...b.tag_ids].sort().join(',');

/**
 * Keeps unsaved edits in this browser, so a crash, a closed tab or a lost
 * connection doesn't lose them. Never touches the server or the live post.
 *
 * Unsaved edits are written a moment after typing stops. When the editor
 * opens with a copy that's newer than the saved post and differs from it,
 * `pending` holds it so the editor can offer to restore it.
 */
export const useLocalDraft = ({
  storageKey,
  values,
  isDirty,
  savedAt,
  ready,
}: {
  storageKey: string | null;
  values: DraftValues;
  isDirty: boolean;
  /** When the post was last saved (ISO); null for a new post */
  savedAt: string | null | undefined;
  /** The saved post (if any) has loaded into the form */
  ready: boolean;
}) => {
  const [pending, setPending] = useState<StoredDraft | null>(null);
  const [checked, setChecked] = useState<string | null>(null);

  // Once per post, when it opens: is there an unsaved copy newer than what's
  // saved? Decided during render (React's pattern for adjusting state to new
  // props) rather than in an effect. An older copy is simply ignored, and the
  // next autosave replaces it.
  if (storageKey && ready && checked !== storageKey) {
    setChecked(storageKey);
    const stored = read(storageKey);
    const baseline = savedAt ? Date.parse(savedAt) : 0;
    setPending(stored && stored.savedAt > baseline && differs(stored.values, values) ? stored : null);
  }

  // While there are unsaved edits (and no copy waiting to be restored), keep a copy.
  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (!storageKey || !isDirty || pending) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), values: JSON.parse(serialized) }));
      } catch {
        // Storage full or blocked: autosave quietly does nothing.
      }
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [storageKey, isDirty, pending, serialized]);

  const clear = useCallback(() => {
    setPending(null);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // As above.
    }
  }, [storageKey]);

  return { pending, clear };
};
