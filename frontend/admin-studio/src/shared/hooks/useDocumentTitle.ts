import { useEffect } from 'react';

const APP_NAME = 'Inko Studio';

/**
 * Sets the browser tab title to "{title} · Inko Studio". The page name comes
 * first so it survives tab truncation; `dirty` prefixes a dot to flag unsaved
 * changes (same convention as VS Code / Google Docs). Pass a falsy title while
 * data is still loading to show just the app name.
 */
export const useDocumentTitle = (title?: string | null, dirty = false) => {
  useEffect(() => {
    const base = title ? `${title} · ${APP_NAME}` : APP_NAME;
    document.title = dirty ? `• ${base}` : base;
  }, [title, dirty]);
};
