import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { TaskStatus } from "@task-time-tracker/shared";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS } from "../task-status";

const STATUS_STYLES: Record<TaskStatus, { icon: typeof Circle; className: string }> = {
  PENDING: { icon: Circle, className: "bg-muted text-muted-foreground" },
  IN_PROGRESS: {
    icon: CircleDot,
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  COMPLETED: {
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

// Status is conveyed by icon + text, never by color alone.
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { icon: Icon, className } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
