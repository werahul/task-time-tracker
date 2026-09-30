"use client";

import { formatDuration } from "@task-time-tracker/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveTimer } from "../hooks/use-active-timer";
import { useElapsedSeconds } from "../hooks/use-elapsed-seconds";

/**
 * Total tracked time for a task: the API's SUM of completed sessions, plus the
 * running session's live elapsed time when this task's timer is running, so
 * the total never reads "0s" next to a ticking clock.
 */
export function TotalTime({ taskId, seconds }: { taskId: string; seconds: number | undefined }) {
  const active = useActiveTimer();
  const runningHere = active.data?.taskId === taskId;
  const running = useElapsedSeconds(runningHere ? active.data?.anchorMs : undefined);

  return (
    <div className="grid gap-1">
      <span className="text-sm text-muted-foreground">Total tracked</span>
      {seconds === undefined ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <span className="text-xl font-semibold tabular-nums">
          {formatDuration(seconds + running)}
        </span>
      )}
    </div>
  );
}
