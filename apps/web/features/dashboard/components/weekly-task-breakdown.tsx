import { formatDuration, type WeeklyDay } from "@task-time-tracker/shared";
import { cn } from "@/lib/utils";
import { formatDayLabel, formatShortDayLabel } from "../date";

/** The chart's numbers as a table: per-day time, tasks worked on and completions. */
export function WeeklyTaskBreakdown({ days }: { days: WeeklyDay[] }) {
  return (
    <div className="h-full overflow-x-auto rounded-xl surface">
      <table className="w-full text-sm">
        <caption className="sr-only">Daily breakdown</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-white/[0.07]">
            <th scope="col" className="px-3 py-2.5 sm:px-5 font-normal">
              Day
            </th>
            <th scope="col" className="px-3 py-2.5 sm:px-5 text-right font-normal">
              Tracked
            </th>
            <th scope="col" className="px-3 py-2.5 sm:px-5 text-right font-normal">
              Tasks
            </th>
            <th scope="col" className="px-3 py-2.5 sm:px-5 text-right font-normal">
              <span className="sm:hidden">Done</span>
              <span className="hidden sm:inline">Completed</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {days.map((day) => (
            <tr
              key={day.date}
              className={cn(
                "transition-colors hover:bg-white/[0.025]",
                day.isFuture && "text-muted-foreground",
              )}
            >
              <th
                scope="row"
                className="px-3 py-2.5 sm:px-5 text-left font-normal whitespace-nowrap"
              >
                <span className="sm:hidden">{formatShortDayLabel(day.date)}</span>
                <span className="hidden sm:inline">{formatDayLabel(day.date)}</span>
              </th>
              {day.isFuture ? (
                <td colSpan={3} className="px-3 py-2.5 sm:px-5 text-right">
                  —
                </td>
              ) : (
                <>
                  <td className="px-3 py-2.5 sm:px-5 text-right font-medium tabular-nums">
                    {formatDuration(day.trackedSeconds)}
                  </td>
                  <td className="px-3 py-2.5 sm:px-5 text-right tabular-nums">
                    {day.tasksWorkedOn}
                  </td>
                  <td className="px-3 py-2.5 sm:px-5 text-right tabular-nums">
                    {day.completedTasks}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
