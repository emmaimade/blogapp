import type { Blocker } from 'react-router-dom';
import { Modal } from './Modal';

/** The "Discard changes?" prompt for a navigation useUnsavedChangesGuard blocked. */
export const UnsavedChangesDialog = ({ blocker }: { blocker: Blocker }) => (
  <Modal
    isOpen={blocker.state === 'blocked'}
    onClose={() => blocker.reset?.()}
    onConfirm={() => blocker.proceed?.()}
    title="Discard unsaved changes?"
    message="You have changes that haven't been saved. If you leave now, they'll be lost."
    confirmText="Discard changes"
    cancelText="Keep editing"
    // Proceeding resolves the blocker; closing too would also reset it.
    autoClose={false}
  />
);
