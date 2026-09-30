import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Allowed status changes. Work normally flows PENDING → IN_PROGRESS → COMPLETED;
 * a small task may be completed straight from PENDING, work can be paused back
 * to PENDING, and a completed task is reopened into IN_PROGRESS (not PENDING).
 */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ["IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["PENDING", "COMPLETED"],
  COMPLETED: ["IN_PROGRESS"],
};

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || TASK_STATUS_TRANSITIONS[from].includes(to);
}

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  errorMap: () => ({ message: `Status must be one of: ${TASK_STATUSES.join(", ")}` }),
});

const titleSchema = z
  .string({ required_error: "Title is required" })
  .trim()
  .min(1, "Title is required")
  .max(TASK_TITLE_MAX_LENGTH, `Title must be at most ${TASK_TITLE_MAX_LENGTH} characters`);

// Blank descriptions are stored as null. `optional()` is outermost so an
// omitted key stays omitted (a PATCH without it must not clear it).
const descriptionSchema = z
  .string()
  .trim()
  .max(
    TASK_DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${TASK_DESCRIPTION_MAX_LENGTH} characters`,
  )
  .transform((value) => value || null)
  .nullable()
  .optional();

/**
 * Shape of an AI task suggestion, validated before it leaves the API. It uses
 * the same title/description rules as task creation, so an accepted suggestion
 * is always a valid `POST /tasks` body. Extra keys from the model are dropped.
 */
export const taskSuggestionSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.transform((value) => value ?? null),
});

/** Default cap on natural-language input for AI suggestions (the API's limit is configurable). */
export const TASK_SUGGESTION_INPUT_MAX_LENGTH = 1000;
export const TASK_SUGGESTION_INPUT_MIN_LENGTH = 3;

export type TaskSuggestion = z.infer<typeof taskSuggestionSchema>;

/** Unknown keys (e.g. userId, id, createdAt) are rejected, never silently applied. */
export const createTaskSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    status: taskStatusSchema,
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });

export const listTasksQuerySchema = paginationQuerySchema.extend({
  status: taskStatusSchema.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

/** A task as serialized over the wire (dates are ISO strings). */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** When the task was last marked COMPLETED; null otherwise. */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
