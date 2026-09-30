import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { TaskStatus } from "@task-time-tracker/shared";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS } from "../task-status";

const STATUS_STYLES: Record<TaskStatus, { icon: typeof Circle; className: string }> = {
  PENDING: { icon: Circle, className: "bg-white/[0.05] text-muted-foreground ring-white/10" },
  IN_PROGRESS: {
    icon: CircleDot,
    className: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
  },
  COMPLETED: {
    icon: CheckCircle2,
    className: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
  },
};

// Status is conveyed by icon + text, never by color alone.
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { icon: Icon, className } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
