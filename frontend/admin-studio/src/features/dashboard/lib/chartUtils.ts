import React from 'react';

// Shared by the studio's hand-drawn SVG charts (dashboard Views card, the
// Analytics page). Colors are picked per chart; see each chart's header.

export const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** A clean axis maximum (1, 2, 5 × 10ⁿ) at or above the data's peak. */
export const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
};

/** Width of the element, kept up to date as the layout changes. */
export const useWidth = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
};

/** A column growing up from its baseline: 4px rounded top, square base. */
export const columnPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
};

/** A column hanging down from its baseline at `y`: square top, 4px rounded bottom. */
export const downColumnPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  const bottom = y + h;
  return `M${x},${y} V${bottom - r} Q${x},${bottom} ${x + r},${bottom} H${x + w - r} Q${x + w},${bottom} ${x + w},${bottom - r} V${y} Z`;
};
