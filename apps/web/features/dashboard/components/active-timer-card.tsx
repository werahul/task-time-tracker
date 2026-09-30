"use client";

import Link from "next/link";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClock } from "@/features/time-tracking/format";
import {
  timerErrorMessage,
  useActiveTimer,
  useStopTimer,
} from "@/features/time-tracking/hooks/use-active-timer";
import { useElapsedSeconds } from "@/features/time-tracking/hooks/use-elapsed-seconds";

/**
 * The running timer, read from the same active-timer query as the rest of the
 * app (the single client copy of server state), with a live elapsed clock.
 */
export function ActiveTimerCard() {
  const active = useActiveTimer();
  const stop = useStopTimer();
  const elapsed = useElapsedSeconds(active.data?.anchorMs);

  if (active.isPending) return <Skeleton className="h-16 w-full rounded-xl" />;

  if (!active.data) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-4">
        <p className="text-sm text-muted-foreground">No timer running</p>
        <Link href="/tasks" className="text-sm text-primary hover:underline">
          Pick a task to start
        </Link>
      </div>
    );
  }

  const timer = active.data;
  return (
    <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/tasks/${timer.taskId}`}
          className="min-w-0 flex-1 truncate font-medium hover:underline"
        >
          {timer.task.title}
        </Link>
        <span role="timer" className="font-mono text-lg font-medium tabular-nums">
          {formatClock(elapsed)}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={stop.isPending}
          onClick={() => stop.mutate(timer.taskId)}
        >
          <Square className="fill-current" /> {stop.isPending ? "Stopping..." : "Stop"}
        </Button>
      </div>
      {stop.isError && (
        <p role="alert" className="text-xs text-destructive">
          {timerErrorMessage(stop.error)}
        </p>
      )}
    </div>
  );
}
