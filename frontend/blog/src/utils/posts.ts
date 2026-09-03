const WORDS_PER_MINUTE = 200;

/** Estimated reading time in minutes, from raw Markdown word count. */
export const getReadingTime = (content: string): number => {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
};

/** Strips Markdown syntax down to plain text and truncates for preview use. */
export const getPlainExcerpt = (content: string, length: number = 150): string => {
  if (!content) return '';

  const clean = content
    .replace(/^#+\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
};
