import type { SyntheticEvent } from 'react';

const PLACEHOLDER = '/placeholder.svg';

/**
 * Applies a Cloudinary resize/format transform so a thumbnail isn't
 * downloaded at its full upload resolution for a small display slot.
 * Falls through unchanged for non-Cloudinary URLs (e.g. local fixtures).
 */
export const getThumbnailUrl = (url: string | null | undefined, width: number): string => {
  if (!url) return PLACEHOLDER;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_fill/`);
};

/**
 * Attach as `onError` on any post-thumbnail <img>. Swaps a broken or
 * timed-out image to the local placeholder instead of leaving a blank gap.
 */
export const handleThumbnailError = (e: SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src.endsWith(PLACEHOLDER)) return; // don't loop if the placeholder itself fails
  img.src = PLACEHOLDER;
};
