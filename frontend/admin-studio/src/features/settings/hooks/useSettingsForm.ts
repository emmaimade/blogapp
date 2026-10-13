import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Blocker } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useUnsavedChangesGuard } from '../../../shared/hooks/useUnsavedChangesGuard';
import { toastApiError } from '../../../shared/lib/apiErrors';

interface UseSettingsFormOptions<T> {
  queryKey: QueryKey;
  load: () => Promise<T>;
  enabled: boolean;
  /** Gets the edited values and the last saved ones, so it can send only what changed. */
  save: (values: T, saved: T) => Promise<unknown>;
  /** Shown after saving, e.g. "SEO settings saved". */
  successMessage: string;
  /** Fallback when the API sends no reason. */
  errorMessage: string;
  /** Blocks saving while it returns a message; the message is shown as a toast. */
  validate?: (values: T) => string | null;
  /** Other caches that show these settings. */
  invalidate?: QueryKey[];
}

export interface SettingsFormState<T> {
  /** What the form shows: the edits if there are any, otherwise what's saved. */
  values: T;
  saved: T | undefined;
  update: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (next: (current: T) => T) => void;
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  retry: () => void;
  isDirty: boolean;
  isSaving: boolean;
  save: () => void;
  discard: () => void;
  blocker: Blocker;
}

const sameValues = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Loading, editing and saving one settings page.
 *
 * Edits live in a draft on top of the saved values rather than in a copy, so a
 * background refetch never wipes what the owner is typing, and changing a
 * field back to its saved value clears the "unsaved changes" state.
 */
export function useSettingsForm<T>({
  queryKey,
  load,
  enabled,
  save,
  successMessage,
  errorMessage,
  validate,
  invalidate = [],
}: UseSettingsFormOptions<T>): SettingsFormState<T> {
  const queryClient = useQueryClient();
  const query = useQuery<T>({ queryKey, queryFn: load, enabled });
  const [draft, setDraft] = useState<T | null>(null);

  const saved = query.data;
  const values = (draft ?? saved) as T;
  const isDirty = draft !== null && saved !== undefined && !sameValues(draft, saved);

  const mutation = useMutation({
    mutationFn: (next: T) => save(next, saved as T),
    onSuccess: (_, next) => {
      // Show what was saved straight away; the refetch then picks up anything
      // the server normalised.
      queryClient.setQueryData(queryKey, next);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey });
      invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast.success(successMessage);
    },
    onError: (error) => toastApiError(error, errorMessage),
  });

  const setValues = (next: (current: T) => T) => {
    setDraft((current) => next(current ?? (saved as T)));
  };

  const blocker = useUnsavedChangesGuard(isDirty);

  return {
    values,
    saved,
    update: (field, value) => setValues((current) => ({ ...current, [field]: value })),
    setValues,
    // Also covers the moment before the workspace is known: there's nothing to show yet.
    isLoading: saved === undefined && !query.isError,
    isError: query.isError && saved === undefined,
    isRetrying: query.isFetching,
    retry: () => query.refetch(),
    isDirty,
    isSaving: mutation.isPending,
    save: () => {
      if (!isDirty || mutation.isPending) return;
      const problem = validate?.(values);
      if (problem) {
        toast.error(problem);
        return;
      }
      mutation.mutate(values);
    },
    discard: () => setDraft(null),
    blocker,
  };
}
