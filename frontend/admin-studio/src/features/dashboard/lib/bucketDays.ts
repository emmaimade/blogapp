import type { AnalyticsDay, StatsRange } from '../hooks/useAnalytics';

export interface ChartBucket {
  label: string; // tooltip heading
  tick: string; // short x-axis label
  views: number;
  visitors: number | null;
}

const UTC_DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const UTC_MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const UTC_MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);

const sumVisitors = (days: AnalyticsDay[]) =>
  days[0]?.visitors === null ? null : days.reduce((total, d) => total + (d.visitors ?? 0), 0);

/**
 * Short ranges plot each day; 90 days groups into weeks and 12 months into
 * calendar months, so the chart keeps a readable number of columns.
 */
export const bucketDays = (days: AnalyticsDay[], range: StatsRange): ChartBucket[] => {
  if (range === '7d' || range === '30d') {
    return days.map((d) => {
      const date = parseDay(d.day);
      return { label: UTC_DAY.format(date), tick: UTC_DAY.format(date), views: d.views, visitors: d.visitors };
    });
  }

  if (range === '90d') {
    const buckets: ChartBucket[] = [];
    // Count back from today so the last column is always a full, current week.
    for (let end = days.length; end > 0; end -= 7) {
      const week = days.slice(Math.max(0, end - 7), end);
      const first = parseDay(week[0].day);
      const last = parseDay(week[week.length - 1].day);
      buckets.unshift({
        label: `${UTC_DAY.format(first)} – ${UTC_DAY.format(last)}`,
        tick: UTC_DAY.format(first),
        views: week.reduce((total, d) => total + d.views, 0),
        visitors: sumVisitors(week),
      });
    }
    return buckets;
  }

  const byMonth = new Map<string, AnalyticsDay[]>();
  for (const d of days) {
    const key = d.day.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), d]);
  }
  const months = [...byMonth.values()];
  return months.map((month, i) => {
    const date = parseDay(month[0].day);
    // The range ends today, so the current month is only partly counted.
    const soFar = i === months.length - 1 ? ' (so far)' : '';
    return {
      label: `${UTC_MONTH_YEAR.format(date)}${soFar}`,
      tick: UTC_MONTH.format(date),
      views: month.reduce((total, d) => total + d.views, 0),
      visitors: sumVisitors(month),
    };
  });
};
