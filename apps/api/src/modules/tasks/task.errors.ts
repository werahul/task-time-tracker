import type { TaskStatus } from "@task-time-tracker/shared";
import { AppError } from "../../lib/app-error";

export const TaskErrors = {
  // Used for missing tasks AND other users' tasks, so existence is never revealed.
  notFound: () => new AppError(404, "TASK_NOT_FOUND", "Task not found"),
  invalidStatusTransition: (from: TaskStatus, to: TaskStatus) =>
    new AppError(409, "INVALID_STATUS_TRANSITION", `A ${from} task cannot be moved to ${to}`),
};
