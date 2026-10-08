import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Pass as `navigate(path, { state: LEAVE_AFTER_SAVE })` when a save itself
 * moves on: the form can still read as dirty for that one navigation.
 */
export const LEAVE_AFTER_SAVE = { leaveAfterSave: true } as const;

/**
 * Asks before unsaved edits are lost: the browser's own prompt on reload or
 * tab close, and a blocked in-app navigation — a link, Back, or switching
 * workspace. Render <UnsavedChangesDialog blocker={…} /> with the result.
 *
 * useBlocker needs the data router (createBrowserRouter), which the app uses.
 */
export const useUnsavedChangesGuard = (isDirty: boolean) => {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as { leaveAfterSave?: boolean } | null)?.leaveAfterSave,
  );
};
