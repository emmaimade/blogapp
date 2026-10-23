import React from 'react';
import type { DayGroup } from '../../dashboard/lib/bucketDays';
import { compact, columnPath, downColumnPath, niceMax, useWidth } from '../../dashboard/lib/chartUtils';
import type { OverviewDay } from '../hooks/useAnalyticsPage';

// Gains and losses mirrored on one baseline: new followers rise above it in
// orange-600 (checked with the dataviz validator alongside the page's violet
// views and teal visitors, light and dark), unsubscribes hang below it in a
// recessive gray, so the eye reads net growth from the shapes. Gray, not red:
// red is the studio's status color, and losing followers is normal.

const HEIGHT = 200;
const PAD = { top: 10, right: 8, bottom: 24, left: 36 };

interface Bucket {
  label: string;
  tick: string;
  gained: number;
  lost: number;
}

export const FollowersChart = ({ groups }: { groups: DayGroup<OverviewDay>[] }) => {
  const [ref, width] = useWidth();
  const [active, setActive] = React.useState<number | null>(null);

  const buckets: Bucket[] = groups.map(({ label, tick, days }) => ({
    label,
    tick,
    gained: days.reduce((total, d) => total + d.new_followers, 0),
    lost: days.reduce((total, d) => total + d.unsubscribes, 0),
  }));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const half = plotH / 2;
  const yMax = niceMax(Math.max(...buckets.map((b) => Math.max(b.gained, b.lost)), 0));
  const baseline = PAD.top + half;
  const scale = (value: number) => (value / yMax) * half;
  const slot = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const cx = (i: number) => PAD.left + slot * i + slot / 2;
  const tickEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 64))));
  const activeBucket = active !== null ? buckets[active] : null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-orange-600" /> New followers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-500" /> Unsubscribed
        </span>
      </div>

      <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="New followers and unsubscribes over time" className="block">
            {[yMax, 0, -yMax].map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left} x2={width - PAD.right} y1={baseline - scale(t)} y2={baseline - scale(t)}
                  className={t === 0 ? 'stroke-zinc-300 dark:stroke-zinc-700' : 'stroke-zinc-200 dark:stroke-zinc-800'}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8} y={baseline - scale(t)} dy="0.32em" textAnchor="end"
                  className="fill-zinc-400 text-[11px] tabular-nums dark:fill-zinc-500"
                >
                  {t > 0 ? `+${compact.format(t)}` : t < 0 ? `−${compact.format(-t)}` : '0'}
                </text>
              </g>
            ))}

            {buckets.map((b, i) => {
              const up = scale(b.gained);
              const down = scale(b.lost);
              const dim = active !== null && active !== i ? 'opacity-40' : '';
              return (
                <g key={b.label}>
                  {up > 0 && (
                    <path d={columnPath(cx(i) - barW / 2, baseline - up - 1, barW, up)} className={`fill-orange-600 transition-opacity ${dim}`} />
                  )}
                  {down > 0 && (
                    <path d={downColumnPath(cx(i) - barW / 2, baseline + 1, barW, down)} className={`fill-zinc-500 transition-opacity ${dim}`} />
                  )}
                  {i % tickEvery === 0 && (
                    <text x={cx(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-zinc-400 text-[11px] dark:fill-zinc-500">
                      {b.tick}
                    </text>
                  )}
                </g>
              );
            })}

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
            className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: Math.min(Math.max(cx(active!), 80), width - 80) }}
          >
            <div className="mb-1 font-semibold text-zinc-900 dark:text-white">{activeBucket.label}</div>
            <div className="flex items-center justify-between gap-4 text-zinc-600 dark:text-zinc-300">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-orange-600" /> New</span>
              <span className="font-semibold tabular-nums">{activeBucket.gained.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-zinc-600 dark:text-zinc-300">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-zinc-500" /> Unsubscribed</span>
              <span className="font-semibold tabular-nums">{activeBucket.lost.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>New followers and unsubscribes by period</caption>
        <thead>
          <tr><th scope="col">Period</th><th scope="col">New followers</th><th scope="col">Unsubscribed</th></tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label}><th scope="row">{b.label}</th><td>{b.gained}</td><td>{b.lost}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
