import type { TaskStatus } from "@task-time-tracker/shared";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/** Menu wording for moving a task into each status. */
export const TASK_STATUS_ACTIONS: Record<TaskStatus, string> = {
  PENDING: "Move back to pending",
  IN_PROGRESS: "Start working",
  COMPLETED: "Mark as completed",
};
