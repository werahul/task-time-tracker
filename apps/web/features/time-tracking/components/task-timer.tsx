"use client";

import { Play, Square } from "lucide-react";
import type { Task } from "@task-time-tracker/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock } from "../format";
import {
  timerErrorMessage,
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "../hooks/use-active-timer";
import { useElapsedSeconds } from "../hooks/use-elapsed-seconds";
import { LiveDot } from "./live-dot";

interface TaskTimerProps {
  task: Pick<Task, "id" | "title" | "status">;
  size?: "sm" | "default";
}

/** Start/Stop control for one task, showing live elapsed time while it runs. */
export function TaskTimer({ task, size = "sm" }: TaskTimerProps) {
  const active = useActiveTimer();
  const start = useStartTimer();
  const stop = useStopTimer();

  const runningHere = active.data?.taskId === task.id;
  const elapsed = useElapsedSeconds(runningHere ? active.data?.anchorMs : undefined);
  const busy = start.isPending || stop.isPending;
  const error = start.error ?? stop.error;

  // Completed tasks can't be timed (the API rejects it); reopen to track more.
  if (task.status === "COMPLETED" && !runningHere) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {runningHere ? (
        <>
          <Button
            size={size}
            variant="outline"
            disabled={busy}
            onClick={() => stop.mutate(task.id)}
            aria-label={`Stop timer for "${task.title}"`}
          >
            <Square className="fill-current" /> {stop.isPending ? "Stopping..." : "Stop timer"}
          </Button>
          <span className="inline-flex items-center gap-2">
            <LiveDot className={size === "sm" ? "size-2" : undefined} />
            <span
              role="timer"
              className={cn(
                "font-mono font-medium tabular-nums",
                size === "sm" ? "text-sm" : "text-3xl tracking-tight",
              )}
            >
              {formatClock(elapsed)}
            </span>
          </span>
        </>
      ) : (
        <Button
          size={size}
          variant="secondary"
          disabled={busy || active.isPending}
          onClick={() => start.mutate(task.id)}
          aria-label={`Start timer for "${task.title}"`}
        >
          <Play className="fill-current" /> {start.isPending ? "Starting..." : "Start timer"}
        </Button>
      )}
      {error && !busy && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {timerErrorMessage(error)}
        </p>
      )}
    </div>
  );
}
