import { CheckCircle2, Clock, ListChecks, type LucideIcon } from "lucide-react";
import { formatDuration } from "@task-time-tracker/shared";

interface ProductivityStatsProps {
  /** Live total (includes the running timer's time since the summary arrived). */
  totalTrackedSeconds: number;
  tasksWorkedOn: number;
  completedTasks: number;
}

export function ProductivityStats({
  totalTrackedSeconds,
  tasksWorkedOn,
  completedTasks,
}: ProductivityStatsProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      <StatCard icon={Clock} label="Total time" value={formatDuration(totalTrackedSeconds)} />
      <StatCard icon={ListChecks} label="Tasks worked on" value={String(tasksWorkedOn)} />
      <StatCard icon={CheckCircle2} label="Completed" value={String(completedTasks)} />
    </ul>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Small print under the value, e.g. what an average is taken over. */
  hint?: string;
}) {
  return (
    <li className="grid gap-2 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </li>
  );
}
