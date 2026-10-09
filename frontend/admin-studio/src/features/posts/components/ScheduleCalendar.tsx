import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay, parseISO, startOfToday } from 'date-fns';

export interface ScheduledPostSummary {
  id: number;
  title: string;
  published_at: string;
}

interface ScheduleCalendarProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  time: string; // "HH:mm", local
  onTimeChange: (time: string) => void;
  /** Other posts already scheduled on this blog — shown as dots on their days. */
  scheduledPosts: ScheduledPostSummary[];
}

const QUICK_TIMES = ['09:00', '12:00', '17:00'];

const quickTimeLabel = (t: string) => format(parseISO(`2000-01-01T${t}`), 'h a');

export const ScheduleCalendar = ({
  date, onDateChange, time, onTimeChange, scheduledPosts,
}: ScheduleCalendarProps) => {
  const scheduled = useMemo(
    () => scheduledPosts.map((p) => ({ ...p, at: parseISO(p.published_at) })),
    [scheduledPosts],
  );
  const postsOn = (day: Date) => scheduled.filter((p) => isSameDay(p.at, day));
  const sameDayPosts = date ? postsOn(date) : [];

  return (
    <div className="space-y-3">
      <DayPicker
        mode="single"
        required={false}
        selected={date}
        onSelect={onDateChange}
        defaultMonth={date}
        startMonth={startOfToday()}
        disabled={{ before: startOfToday() }}
        modifiers={{ hasPost: scheduled.map((p) => p.at) }}
        modifiersClassNames={{
          hasPost:
            "after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-500 after:content-['']",
        }}
        labels={{
          labelDayButton: (day, modifiers) => {
            const n = postsOn(day).length;
            const base = format(day, 'EEEE, MMMM d');
            const suffix = n ? `, ${n} post${n > 1 ? 's' : ''} already scheduled` : '';
            return `${base}${suffix}${modifiers.selected ? ', selected' : ''}`;
          },
        }}
        classNames={{
          root: 'relative w-full',
          months: 'w-full',
          month: 'w-full space-y-2',
          month_caption: 'flex h-8 items-center px-1',
          caption_label: 'text-sm font-semibold text-zinc-900 dark:text-white',
          nav: 'absolute right-0 top-0 z-10 flex h-8 items-center gap-1',
          button_previous:
            'flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-zinc-700',
          button_next:
            'flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-zinc-700',
          chevron: 'h-4 w-4 fill-current',
          month_grid: 'w-full border-collapse',
          weekdays: '',
          weekday: 'pb-1 text-center text-[10px] font-semibold uppercase text-zinc-400',
          week: '',
          day: 'relative p-0 text-center',
          day_button:
            'mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary dark:text-zinc-300 dark:hover:bg-zinc-700',
          today: '[&>button]:font-bold [&>button]:text-primary',
          selected:
            '[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary-hover after:!bg-white',
          disabled: '[&>button]:pointer-events-none [&>button]:opacity-30',
          outside: '[&>button]:text-zinc-400 dark:[&>button]:text-zinc-600',
        }}
      />

      {sameDayPosts.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          <span>
            Also going out that day:{' '}
            {sameDayPosts.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <span className="font-medium">“{p.title || 'Untitled'}”</span> at {format(p.at, 'h:mm a')}
              </span>
            ))}
          </span>
        </p>
      )}

      <div>
        <label htmlFor="schedule-time" className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Time <span className="font-normal text-zinc-400">(your local time)</span>
        </label>
        {/* The sidebar card is narrow: sharing a row with the quick times
            squeezed the input until it clipped its own value ("08:0"). */}
        <input
          id="schedule-time"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
        <div role="group" aria-label="Quick times" className="mt-1.5 flex gap-1.5">
          {QUICK_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTimeChange(t)}
              aria-pressed={time === t}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                time === t
                  ? 'bg-primary text-white'
                  : 'bg-zinc-200/70 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
              }`}
            >
              {quickTimeLabel(t)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
