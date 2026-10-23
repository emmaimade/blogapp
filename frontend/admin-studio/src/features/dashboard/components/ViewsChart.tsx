import React from 'react';
import type { ChartBucket } from '../lib/bucketDays';
import { columnPath, compact, niceMax, useWidth } from '../lib/chartUtils';

// Views are columns, visitors a line, on one shared count axis. Colors were
// checked with the dataviz palette validator against both card surfaces
// (white, zinc-900): violet-600 / violet-500 for views, teal-600 for visitors.

const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 36 };

export const ViewsChart = ({ buckets }: { buckets: ChartBucket[] }) => {
  const [ref, width] = useWidth();
  const [active, setActive] = React.useState<number | null>(null);
  const showVisitors = buckets.some((b) => b.visitors !== null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const peak = Math.max(...buckets.map((b) => Math.max(b.views, b.visitors ?? 0)), 0);
  const yMax = niceMax(peak);
  const ticks = [0, yMax / 2, yMax];
  const slot = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2)); // 2px surface gap between touching columns
  const y = (value: number) => PAD.top + plotH - (value / yMax) * plotH;
  const cx = (i: number) => PAD.left + slot * i + slot / 2;

  // Label only as many x ticks as fit: roughly one per 64px.
  const tickEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 64))));

  const visitorPoints = showVisitors
    ? buckets.map((b, i) => `${cx(i)},${y(b.visitors ?? 0)}`).join(' ')
    : '';

  const activeBucket = active !== null ? buckets[active] : null;

  return (
    <div>
      {showVisitors && (
        <div className="mb-3 flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-600 dark:bg-violet-500" /> Views
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-teal-600" /> Visitors
          </span>
        </div>
      )}

      <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Views over time" className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)}
                  className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1}
                />
                <text
                  x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end"
                  className="fill-zinc-400 text-[11px] tabular-nums dark:fill-zinc-500"
                >
                  {compact.format(t)}
                </text>
              </g>
            ))}

            {buckets.map((b, i) => {
              const h = (b.views / yMax) * plotH;
              return (
                <g key={b.label}>
                  {h > 0 && (
                    <path
                      d={columnPath(cx(i) - barW / 2, y(b.views), barW, h)}
                      className={`fill-violet-600 transition-opacity dark:fill-violet-500 ${
                        active !== null && active !== i ? 'opacity-40' : ''
                      }`}
                    />
                  )}
                  {i % tickEvery === 0 && (
                    <text
                      x={cx(i)} y={HEIGHT - 6} textAnchor="middle"
                      className="fill-zinc-400 text-[11px] dark:fill-zinc-500"
                    >
                      {b.tick}
                    </text>
                  )}
                </g>
              );
            })}

            {showVisitors && (
              <polyline
                points={visitorPoints} fill="none" strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" className="stroke-teal-600"
              />
            )}
            {showVisitors && activeBucket && (
              <circle
                cx={cx(active!)} cy={y(activeBucket.visitors ?? 0)} r={4} strokeWidth={2}
                className="fill-teal-600 stroke-white dark:stroke-zinc-900"
              />
            )}

            {/* Hit targets: the whole column slot, so thin bars are easy to hover. */}
            {buckets.map((b, i) => (
              <rect
                key={`hit-${b.label}`}
                x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onTouchStart={() => setActive(i)}
              />
            ))}
          </svg>
        )}

        {activeBucket && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: Math.min(Math.max(cx(active!), 72), width - 72) }}
          >
            <div className="mb-1 font-semibold text-zinc-900 dark:text-white">{activeBucket.label}</div>
            <div className="flex items-center justify-between gap-4 text-zinc-600 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-violet-600 dark:bg-violet-500" /> Views
              </span>
              <span className="font-semibold tabular-nums">{activeBucket.views.toLocaleString()}</span>
            </div>
            {activeBucket.visitors !== null && (
              <div className="flex items-center justify-between gap-4 text-zinc-600 dark:text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-2 rounded-full bg-teal-600" /> Visitors
                </span>
                <span className="font-semibold tabular-nums">{activeBucket.visitors.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>Views{showVisitors ? ' and visitors' : ''} by period</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Views</th>
            {showVisitors && <th scope="col">Visitors</th>}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{b.views}</td>
              {showVisitors && <td>{b.visitors}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
