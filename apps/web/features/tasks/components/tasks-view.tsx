"use client";

import { useState } from "react";
import { AlertCircle, ClipboardList, Plus } from "lucide-react";
import { TASK_STATUSES, type TaskStatus } from "@task-time-tracker/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTasks } from "../hooks/use-tasks";
import { TASK_STATUS_LABELS } from "../task-status";
import { TaskCard } from "./task-card";
import { CreateTaskDialog } from "./task-dialogs";

const PAGE_SIZE = 20;
const FILTERS: { value: TaskStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  ...TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })),
];

export function TasksView() {
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const tasks = useTasks({ status, page, limit: PAGE_SIZE });

  // Deleting the last task on a later page leaves it empty; step back to the last real page.
  const settledData = tasks.isPlaceholderData ? undefined : tasks.data;
  if (settledData && page > 1 && settledData.items.length === 0) {
    setPage(Math.max(1, settledData.pagination.totalPages));
  }

  const selectFilter = (value: TaskStatus | undefined) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Everything you&apos;re working on.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New task
        </Button>
      </div>

      <div role="group" aria-label="Filter tasks by status" className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={label}
            size="sm"
            variant={status === value ? "default" : "outline"}
            aria-pressed={status === value}
            onClick={() => selectFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <section aria-live="polite" aria-busy={tasks.isPending} className="grid gap-4">
        {tasks.isPending ? (
          <TaskListSkeleton />
        ) : tasks.isError ? (
          <StateMessage
            icon={AlertCircle}
            title="We couldn't load your tasks"
            description="Please check your connection and try again."
            action={
              <Button variant="outline" onClick={() => tasks.refetch()}>
                Try again
              </Button>
            }
          />
        ) : tasks.data.items.length === 0 ? (
          status ? (
            <StateMessage
              icon={ClipboardList}
              title={`No ${TASK_STATUS_LABELS[status].toLowerCase()} tasks`}
              description="Try another filter, or create a new task."
            />
          ) : (
            <StateMessage
              icon={ClipboardList}
              title="No tasks yet"
              description="Create your first task to start tracking your productivity."
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus /> Create a task
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className={cn("grid gap-3", tasks.isPlaceholderData && "opacity-60")}>
              {tasks.data.items.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </ul>
            <Pagination
              page={page}
              totalPages={tasks.data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <CreateTaskDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <ul className="grid gap-3" aria-label="Loading tasks">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="grid gap-3 rounded-xl border border-border p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

interface StateMessageProps {
  icon: typeof ClipboardList;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function StateMessage({ icon: Icon, title, description, action }: StateMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <div className="grid gap-1">
        <h2 className="font-medium">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Task pages" className="flex items-center justify-between gap-3">
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
  );
}
