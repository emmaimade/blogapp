import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query matches, kept current as the window changes.
 * For rendering one thing or another (not just hiding with CSS), where both
 * being mounted would matter — a sponsor counting two impressions, say.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};
