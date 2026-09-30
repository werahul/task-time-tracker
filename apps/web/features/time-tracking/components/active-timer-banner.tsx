"use client";

import Link from "next/link";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "../format";
import { timerErrorMessage, useActiveTimer, useStopTimer } from "../hooks/use-active-timer";
import { useElapsedSeconds } from "../hooks/use-elapsed-seconds";

/** App-wide indicator of the running timer, so it's visible from any page. */
export function ActiveTimerBanner() {
  const { data: timer } = useActiveTimer();
  const stop = useStopTimer();
  const elapsed = useElapsedSeconds(timer?.anchorMs);

  if (!timer) return null;

  return (
    <section
      aria-label="Running timer"
      className="border-b border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span className="text-muted-foreground">Working on:</span>
          <Link href={`/tasks/${timer.taskId}`} className="truncate font-medium hover:underline">
            {timer.task.title}
          </Link>
        </p>
        <span role="timer" className="font-mono text-sm font-medium tabular-nums">
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
        {stop.isError && (
          <p role="alert" className="basis-full text-xs text-destructive">
            {timerErrorMessage(stop.error)}
          </p>
        )}
      </div>
    </section>
  );
}
