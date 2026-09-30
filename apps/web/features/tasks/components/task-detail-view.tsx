"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskTimer } from "@/features/time-tracking/components/task-timer";
import { TimeLogList } from "@/features/time-tracking/components/time-log-list";
import { TotalTime } from "@/features/time-tracking/components/total-time";
import { useTaskTimeLogs } from "@/features/time-tracking/hooks/use-time-logs";
import { ApiRequestError } from "@/lib/api/client";
import { useTask } from "../hooks/use-tasks";
import { TaskStatusBadge } from "./task-status-badge";

const LOG_PAGE_SIZE = 10;

export function TaskDetailView({ taskId }: { taskId: string }) {
  const task = useTask(taskId);
  const [page, setPage] = useState(1);
  const logs = useTaskTimeLogs(taskId, { page, limit: LOG_PAGE_SIZE });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/tasks"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All tasks
      </Link>

      {task.isPending ? (
        <div className="grid gap-3" aria-busy>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      ) : task.isError ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          {task.error instanceof ApiRequestError && task.error.status === 404 ? (
            <>
              <h1 className="font-medium">Task not found</h1>
              <p className="text-sm text-muted-foreground">
                It may have been deleted, or the link is incorrect.
              </p>
            </>
          ) : (
            <div className="grid justify-items-center gap-3">
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t load this task. Check your connection and try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => task.refetch()}>
                Try again
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight break-words">
                {task.data.title}
              </h1>
              <TaskStatusBadge status={task.data.status} />
            </div>
            {task.data.description && (
              <p className="whitespace-pre-line break-words text-muted-foreground">
                {task.data.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <TaskTimer task={task.data} size="default" />
            <TotalTime taskId={taskId} seconds={logs.data?.totalSeconds} />
          </div>

          <section className="grid gap-3" aria-labelledby="sessions-heading">
            <h2 id="sessions-heading" className="font-medium">
              Sessions
            </h2>
            <TimeLogList
              data={logs.data}
              isPending={logs.isPending}
              isError={logs.isError}
              isPlaceholderData={logs.isPlaceholderData}
              onRetry={() => logs.refetch()}
              page={page}
              onPageChange={setPage}
            />
          </section>
        </>
      )}
    </div>
  );
}
