"use client";

import Link from "next/link";
import { ArrowRight, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveDot } from "@/features/time-tracking/components/live-dot";
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

  if (active.isPending) return <Skeleton className="h-24 w-full rounded-xl" />;

  if (!active.data) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-5">
        <p className="flex items-center gap-3 text-sm text-muted-foreground">No timer running</p>
        <Link
          href="/tasks"
          className="group inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-orange-300"
        >
          Pick a task to start
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    );
  }

  const timer = active.data;
  return (
    <div className="grid gap-2 rounded-xl surface-accent px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="grid min-w-0 flex-1 basis-full gap-1 sm:basis-auto">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <LiveDot className="size-2" /> Tracking
          </span>
          <Link
            href={`/tasks/${timer.taskId}`}
            className="truncate text-lg font-semibold tracking-tight hover:underline"
          >
            {timer.task.title}
          </Link>
        </div>
        <span
          role="timer"
          className="mr-auto font-mono text-2xl font-medium tracking-tight tabular-nums sm:mr-0 sm:text-3xl"
        >
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
