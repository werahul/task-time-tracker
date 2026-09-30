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
    <ol className="divide-y divide-border rounded-xl border border-border bg-card">
      {tasks.map((task) => (
        <li key={task.taskId} className="flex items-center justify-between gap-4 px-4 py-3">
          <Link href={`/tasks/${task.taskId}`} className="truncate text-sm hover:underline">
            {task.title}
          </Link>
          <span className="shrink-0 text-sm tabular-nums">
            <span className="font-medium">{formatDuration(task.trackedSeconds)}</span>
            {totalSeconds ? (
              <span className="text-muted-foreground">
                {" "}
                · {share(task.trackedSeconds, totalSeconds)}
              </span>
            ) : null}
          </span>
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
