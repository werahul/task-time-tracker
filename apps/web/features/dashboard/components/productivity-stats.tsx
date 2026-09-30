import { formatDuration } from "@task-time-tracker/shared";
import { cn } from "@/lib/utils";

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
    <StatStrip className="sm:grid-cols-3">
      <StatCard
        className="col-span-2 sm:col-span-1"
        label="Total time"
        value={formatDuration(totalTrackedSeconds)}
      />
      <StatCard label="Tasks worked on" value={String(tasksWorkedOn)} />
      <StatCard label="Completed" value={String(completedTasks)} />
    </StatStrip>
  );
}

/** One bordered panel split into cells by hairlines (the 1px gap shows the border colour). */
export function StatStrip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07]",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  /** Small print under the value, e.g. what an average is taken over. */
  hint?: string;
  className?: string;
}) {
  return (
    <li className={cn("grid content-start gap-1.5 bg-card px-5 py-4", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </li>
  );
}
