"use client";

import Link from "next/link";
import { AlertCircle, Clock } from "lucide-react";
import { formatDuration, type Paginated, type TimeLog } from "@task-time-tracker/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatSessionTime } from "../format";

interface TimeLogListProps {
  data: Paginated<TimeLog> | undefined;
  isPending: boolean;
  isError: boolean;
  isPlaceholderData?: boolean;
  onRetry: () => void;
  /** Show each log's task title (off on a single task's page). */
  showTask?: boolean;
  page: number;
  onPageChange: (page: number) => void;
}

export function TimeLogList({
  data,
  isPending,
  isError,
  isPlaceholderData = false,
  onRetry,
  showTask = false,
  page,
  onPageChange,
}: TimeLogListProps) {
  if (isPending) {
    return (
      <ul className="grid gap-2" aria-label="Loading time logs">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex justify-between gap-4 rounded-lg border border-border p-3">
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-12" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <AlertCircle className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">We couldn&apos;t load your time logs.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <Clock className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">No time tracked yet.</p>
        <p className="text-sm text-muted-foreground">Start a timer when you begin working.</p>
      </div>
    );
  }

  const { totalPages } = data.pagination;

  return (
    <div className="grid gap-3">
      <ul className={cn("grid gap-2", isPlaceholderData && "opacity-60")}>
        {data.items.map((log) => (
          <li
            key={log.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
          >
            <div className="grid min-w-0 gap-0.5">
              {showTask && (
                <Link
                  href={`/tasks/${log.taskId}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {log.task.title}
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                {formatSessionTime(log.startedAt, log.stoppedAt)}
              </span>
            </div>
            {log.stoppedAt ? (
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatDuration(log.durationSeconds)}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Running
              </span>
            )}
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav aria-label="Time log pages" className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
