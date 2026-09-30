"use client";

import { getErrorMessage } from "@/lib/api/errors";
import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { TASK_STATUS_TRANSITIONS, type Task } from "@task-time-tracker/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskTimer } from "@/features/time-tracking/components/task-timer";
import { useUpdateTask } from "../hooks/use-tasks";
import { TASK_STATUS_ACTIONS } from "../task-status";
import { DeleteTaskDialog, EditTaskDialog } from "./task-dialogs";
import { TaskStatusBadge } from "./task-status-badge";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function TaskCard({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const updateTask = useUpdateTask();

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="font-medium break-words">
            <Link href={`/tasks/${task.id}`} className="hover:underline">
              {task.title}
            </Link>
          </h3>
          {task.description && (
            <p className="text-sm whitespace-pre-line break-words text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for "${task.title}"`} />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {TASK_STATUS_TRANSITIONS[task.status].map((status) => (
                <DropdownMenuItem
                  key={status}
                  disabled={updateTask.isPending}
                  onClick={() => updateTask.mutate({ id: task.id, input: { status } })}
                >
                  {TASK_STATUS_ACTIONS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <TaskStatusBadge status={task.status} />
          <time dateTime={task.createdAt}>
            Created {dateFormatter.format(new Date(task.createdAt))}
          </time>
        </div>
        <TaskTimer task={task} />
      </div>

      {updateTask.isError && (
        <p role="alert" className="text-xs text-destructive">
          {getErrorMessage(updateTask.error)}
        </p>
      )}

      <EditTaskDialog task={task} open={editing} onOpenChange={setEditing} />
      <DeleteTaskDialog task={task} open={deleting} onOpenChange={setDeleting} />
    </li>
  );
}
