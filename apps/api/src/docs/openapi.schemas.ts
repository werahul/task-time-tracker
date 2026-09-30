import { createRequire } from "node:module";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { TASK_STATUSES } from "@task-time-tracker/shared";
import { z } from "zod";

// Must run before any `.openapi()` call. Two Zod instances can exist at once
// (the "dual package hazard"): this file's `zod` import, and the CommonJS copy
// the compiled @task-time-tracker/shared package `require`s — they differ when
// the API runs as ESM (e.g. under Vitest). Patch both so the shared request
// schemas can be documented too. In production they're one instance, and
// extending twice is a no-op.
extendZodWithOpenApi(z);
extendZodWithOpenApi(createRequire(__filename)("zod") as typeof import("zod"));

/**
 * Response shapes, for documentation AND for contract tests that parse real
 * responses against them — so the docs fail loudly if the API drifts.
 */

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });

export const ErrorResponse = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: "TASK_NOT_FOUND" }),
      message: z.string().openapi({ example: "Task not found" }),
      details: z
        .record(z.array(z.string()))
        .optional()
        .openapi({ description: "Per-field validation messages (VALIDATION_ERROR only)" }),
      requestId: z.string().optional().openapi({ description: "Matches the X-Request-ID header" }),
    }),
  })
  .strict()
  .openapi("ErrorResponse");

export const success = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data }).strict();

export const Pagination = z
  .object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict()
  .openapi("Pagination");

export const User = z
  .object({ id: uuid, name: z.string(), email: z.string().email() })
  .strict()
  .openapi("User");

export const Task = z
  .object({
    id: uuid,
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(TASK_STATUSES),
    completedAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict()
  .openapi("Task");

export const TimeLog = z
  .object({
    id: uuid,
    taskId: uuid,
    task: z.object({ id: uuid, title: z.string() }).strict(),
    startedAt: isoDateTime,
    stoppedAt: isoDateTime.nullable().openapi({ description: "null while the timer runs" }),
    durationSeconds: z.number().int().min(0),
  })
  .strict()
  .openapi("TimeLog");

export const ActiveTimer = TimeLog.extend({
  stoppedAt: z.null(),
  elapsedSeconds: z.number().int().min(0).openapi({
    description: "Server-computed at response time; clients render from this, not their clock",
  }),
  elapsedMs: z.number().int().min(0).openapi({
    description:
      "Same, in milliseconds: anchor live clocks on this so a reload doesn't lose up to 1 s",
  }),
})
  .strict()
  .openapi("ActiveTimer");

export const TaskSuggestion = z
  .object({ title: z.string(), description: z.string().nullable() })
  .strict()
  .openapi("TaskSuggestion");

export const DailySummary = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string(),
    range: z.object({ start: isoDateTime, end: isoDateTime }).strict(),
    isToday: z.boolean(),
    totalTrackedSeconds: z.number().int().min(0),
    totalTrackedFormatted: z.string(),
    tasksWorkedOn: z.number().int().min(0),
    completedTasks: z.number().int().min(0),
    pendingTasks: z.number().int().min(0),
    inProgressTasks: z.number().int().min(0),
    activeTimer: z
      .object({
        taskId: uuid,
        title: z.string(),
        startedAt: isoDateTime,
        elapsedSeconds: z.number().int().min(0),
      })
      .strict()
      .nullable(),
    topTasks: z.array(
      z.object({ taskId: uuid, title: z.string(), trackedSeconds: z.number().int() }).strict(),
    ),
    insights: z.array(z.string()),
  })
  .strict()
  .openapi("DailySummary");

const isoDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().min(0);

export const WeeklySummary = z
  .object({
    startDate: isoDateOnly.openapi({ description: "Monday of the week" }),
    endDate: isoDateOnly.openapi({ description: "Sunday of the week (inclusive)" }),
    timezone: z.string(),
    range: z.object({ start: isoDateTime, end: isoDateTime }).strict(),
    isCurrentWeek: z.boolean(),
    elapsedDays: z.number().int().min(1).max(7),
    totalTrackedSeconds: count,
    totalTrackedFormatted: z.string(),
    averageDailySeconds: count.openapi({
      description: "totalTrackedSeconds / elapsedDays, rounded down (idle days count)",
    }),
    averageDailyFormatted: z.string(),
    tasksWorkedOn: count,
    completedTasks: count,
    dailyBreakdown: z
      .array(
        z
          .object({
            date: isoDateOnly,
            trackedSeconds: count,
            tasksWorkedOn: count,
            completedTasks: count,
            isFuture: z.boolean(),
          })
          .strict(),
      )
      .length(7),
    topTasks: z.array(
      z.object({ taskId: uuid, title: z.string(), trackedSeconds: count }).strict(),
    ),
  })
  .strict()
  .openapi("WeeklySummary");

export const Message = z.object({ message: z.string() }).strict();

export const responses = {
  user: success(z.object({ user: User }).strict()),
  task: success(z.object({ task: Task }).strict()),
  taskList: success(z.object({ items: z.array(Task), pagination: Pagination }).strict()),
  timeLog: success(TimeLog),
  activeTimer: success(ActiveTimer),
  activeTimerOrNull: success(ActiveTimer.nullable()),
  timeLogList: success(z.object({ items: z.array(TimeLog), pagination: Pagination }).strict()),
  taskTimeLogs: success(
    z
      .object({ items: z.array(TimeLog), pagination: Pagination, totalSeconds: z.number().int() })
      .strict(),
  ),
  dailySummary: success(DailySummary),
  weeklySummary: success(WeeklySummary),
  suggestion: success(TaskSuggestion),
  message: success(Message),
};
