import type { LucideProps } from 'lucide-react';

// lucide only ships the retired Twitter bird, so X's mark is inlined here.
// It accepts the subset of LucideProps the social-link slots pass, so it drops
// in wherever a lucide icon goes; the padded viewBox keeps the solid glyph
// optically the same size as their stroked outlines.
export const XIcon = ({
  size = 24,
  className,
  'aria-hidden': ariaHidden,
}: Pick<LucideProps, 'size' | 'className' | 'aria-hidden'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="-2 -2 28 28"
    fill="currentColor"
    className={className}
    aria-hidden={ariaHidden}
  >
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);
