import { useCallback } from 'react';
import { workspacePath } from '../../shared/lib/workspacePaths';
import { useBlog } from './BlogProvider';

/**
 * Builds links into the active workspace: `to('/posts/new')` →
 * `/admin/w/acme/posts/new`. Without any workspace it falls back to /admin,
 * which explains that state.
 */
export function useWorkspacePath() {
  const { activeBlog } = useBlog();
  const slug = activeBlog?.slug;
  return useCallback((path = '/dashboard') => (slug ? workspacePath(slug, path) : '/admin'), [slug]);
}
