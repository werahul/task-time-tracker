import Link from "next/link";
import { formatDuration, type DailyTopTask } from "@task-time-tracker/shared";

/**
 * Tasks ranked by time tracked within the period (aggregated by the API).
 * With `totalSeconds` (the period's API total), each row also shows its share.
 */
export function TopTasks({
  tasks,
  totalSeconds,
}: {
  tasks: DailyTopTask[];
  totalSeconds?: number;
}) {
  return (
    <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-xl surface">
      {tasks.map((task, index) => (
        <li
          key={task.taskId}
          className="relative flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums"
            >
              {index + 1}
            </span>
            <Link
              href={`/tasks/${task.taskId}`}
              className="truncate text-sm font-medium transition-colors hover:text-orange-200"
            >
              {task.title}
            </Link>
          </span>
          <span className="shrink-0 text-sm tabular-nums">
            <span className="font-medium">{formatDuration(task.trackedSeconds)}</span>
            {totalSeconds ? (
              <span className="text-muted-foreground">
                {" "}
                · {share(task.trackedSeconds, totalSeconds)}
              </span>
            ) : null}
          </span>
          {totalSeconds ? (
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 bg-primary/60"
              style={{ width: `${Math.min(100, (task.trackedSeconds / totalSeconds) * 100)}%` }}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Whole-percent share, capped at 100 (per-task and total seconds are rounded
 * separately); a non-zero share too small to round up reads "<1%", not "0%".
 */
function share(seconds: number, total: number): string {
  const percent = Math.min(100, Math.round((seconds / total) * 100));
  return percent === 0 && seconds > 0 ? "<1%" : `${percent}%`;
}
