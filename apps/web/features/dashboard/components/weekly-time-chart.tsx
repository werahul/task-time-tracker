import { formatDuration, type WeeklyDay } from "@task-time-tracker/shared";
import { cn } from "@/lib/utils";
import { formatDayLabel, formatWeekday } from "../date";

// Gridline spacing candidates; the smallest that needs at most 4 steps wins.
const STEPS = [15 * 60, 30 * 60, 3600, 2 * 3600, 3 * 3600, 4 * 3600, 6 * 3600];

/** Axis scale: a round top value and its gridlines, from 0 up. */
function scaleFor(maxSeconds: number): number[] {
  const step = STEPS.find((s) => maxSeconds / s <= 4) ?? STEPS[STEPS.length - 1];
  const top = Math.max(step, Math.ceil(maxSeconds / step) * step);
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

/** Compact axis label: whole hours as "2h", smaller steps as "30m". */
function axisLabel(seconds: number): string {
  if (seconds === 0) return "0";
  return seconds % 3600 === 0 ? `${seconds / 3600}h` : `${Math.round(seconds / 60)}m`;
}

/**
 * Time tracked per day, Monday → Sunday. One series, so one color and no
 * legend; exact values are in each bar's tooltip (hover or keyboard focus)
 * and in the breakdown table.
 */
export function WeeklyTimeChart({ days }: { days: WeeklyDay[] }) {
  const ticks = scaleFor(Math.max(0, ...days.map((day) => day.trackedSeconds)));
  const top = ticks[ticks.length - 1];

  return (
    <figure className="grid gap-2 rounded-xl border border-border bg-card p-4">
      <figcaption className="sr-only">Hours tracked per day, Monday to Sunday</figcaption>
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        {/* Y axis */}
        <div className="relative h-48 w-8 text-right text-xs text-muted-foreground" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 tabular-nums"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {axisLabel(tick)}
            </span>
          ))}
        </div>

        {/* Plot: gridlines behind, one column per day */}
        <div className="relative h-48">
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={cn(
                "absolute inset-x-0 border-t",
                tick === 0 ? "border-border" : "border-dashed border-border/60",
              )}
              style={{ bottom: `${(tick / top) * 100}%` }}
            />
          ))}
          <ul className="relative grid h-full grid-cols-7 gap-0.5">
            {days.map((day) => (
              <Bar key={day.date} day={day} top={top} />
            ))}
          </ul>
        </div>

        {/* X axis */}
        <div aria-hidden />
        <ul
          className="grid grid-cols-7 gap-0.5 pt-2 text-center text-xs text-muted-foreground"
          aria-hidden
        >
          {days.map((day) => (
            <li key={day.date}>{formatWeekday(day.date)}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function Bar({ day, top }: { day: WeeklyDay; top: number }) {
  const label = formatDayLabel(day.date);
  const value = day.isFuture ? "Not yet" : formatDuration(day.trackedSeconds);
  const heightPct = (day.trackedSeconds / top) * 100;

  return (
    <li
      tabIndex={0}
      aria-label={`${label}: ${day.isFuture ? "hasn't started yet" : `${value} tracked`}`}
      className="group relative flex h-full items-end justify-center rounded-md outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {day.isFuture ? (
        <span className="h-1 w-3/5 max-w-10 rounded-t border border-dashed border-border" />
      ) : day.trackedSeconds === 0 ? (
        // Zero-activity day: a baseline stub so it reads as "0", not "missing".
        <span className="h-0.5 w-3/5 max-w-10 rounded-t bg-muted-foreground/30" />
      ) : (
        <span
          className="w-3/5 max-w-10 min-h-1 rounded-t bg-primary"
          style={{ height: `${heightPct}%` }}
        />
      )}

      {/* Tooltip, anchored just above the bar */}
      <span
        role="tooltip"
        style={{ bottom: `calc(${day.isFuture ? 0 : heightPct}% + 0.5rem)` }}
        className="pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
      >
        <span className="block text-muted-foreground">{label}</span>
        <span className="block font-medium tabular-nums">{value}</span>
      </span>
    </li>
  );
}
