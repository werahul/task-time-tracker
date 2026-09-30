import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  createTaskSchema,
  listTasksQuerySchema,
  loginSchema,
  paginationQuerySchema,
  registerSchema,
  updateTaskSchema,
} from "@task-time-tracker/shared";
import { z } from "zod";
import {
  dailySummaryQuerySchema,
  weeklySummaryQuerySchema,
} from "../modules/dashboard/dashboard.schema";
import { suggestTaskBodySchema } from "../modules/tasks/ai/ai-task.schema";
import { listTimeLogsQueryFields } from "../modules/time-tracking/time-tracking.schema";
import { ErrorResponse, responses } from "./openapi.schemas";

const registry = new OpenAPIRegistry();

const cookieAuth = registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "access_token",
  description: "Short-lived access JWT, set as an HttpOnly cookie by login/register/refresh.",
});
const refreshCookie = registry.registerComponent("securitySchemes", "refreshCookie", {
  type: "apiKey",
  in: "cookie",
  name: "refresh_token",
  description: "Opaque refresh token (HttpOnly, Path=/api/v1/auth). Rotated on every refresh.",
});

const authed = [{ [cookieAuth.name]: [] }];
const taskIdParams = z.object({ id: z.string().uuid() });
const timerParams = z.object({ taskId: z.string().uuid() });

const json = <T extends z.ZodTypeAny>(schema: T) => ({ "application/json": { schema } });
const ok = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: json(schema),
});
/** An error response documenting which error codes the status can carry. */
const err = (description: string, codes: string[]) => ({
  description: `${description}. Codes: ${codes.map((c) => `\`${c}\``).join(", ")}`,
  content: json(ErrorResponse),
});

const common = {
  401: err("Missing, invalid, or expired access token", [
    "AUTHENTICATION_REQUIRED",
    "INVALID_ACCESS_TOKEN",
    "ACCESS_TOKEN_EXPIRED",
  ]),
  422: err("Request failed validation (see `error.details`)", ["VALIDATION_ERROR"]),
  429: err("Rate limit exceeded", ["TOO_MANY_REQUESTS"]),
  taskNotFound: err(
    "No such task for this user — identical for missing, malformed, and other users' ids",
    ["TASK_NOT_FOUND"],
  ),
};

// --- Health -----------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Liveness — the process is up",
  responses: {
    200: ok(
      "Alive",
      z.object({
        success: z.literal(true),
        data: z.object({ status: z.string(), message: z.string() }),
      }),
    ),
  },
});
registry.registerPath({
  method: "get",
  path: "/health/ready",
  tags: ["Health"],
  summary: "Readiness — database reachable and not shutting down",
  responses: {
    200: ok(
      "Ready",
      z.object({
        success: z.literal(true),
        data: z.object({ status: z.string(), checks: z.object({ database: z.string() }) }),
      }),
    ),
    503: err("Not ready (dependency down or shutting down)", ["SERVICE_UNAVAILABLE"]),
  },
});

// --- Auth ---------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Create an account and start a session",
  description:
    "Sets `access_token` and `refresh_token` HttpOnly cookies. Email is trimmed and lowercased.",
  request: { body: { content: json(registerSchema) } },
  responses: {
    201: ok("Registered; auth cookies set", responses.user),
    409: err("Email already registered", ["EMAIL_ALREADY_REGISTERED"]),
    422: common[422],
    429: common[429],
  },
});
registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in and start a session",
  description: "Unknown email and wrong password produce the identical response.",
  request: { body: { content: json(loginSchema) } },
  responses: {
    200: ok("Logged in; auth cookies set", responses.user),
    401: err("Invalid email or password", ["INVALID_CREDENTIALS"]),
    422: common[422],
    429: common[429],
  },
});
registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Rotate the session",
  description:
    "Revokes the presented refresh token and issues new cookies. A reused, revoked, or expired token fails and clears cookies.",
  security: [{ [refreshCookie.name]: [] }],
  responses: {
    200: ok("Rotated; new auth cookies set", responses.message),
    401: err("Refresh token unusable", ["INVALID_REFRESH_TOKEN", "SESSION_EXPIRED"]),
    429: common[429],
  },
});
registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Revoke the session and clear cookies",
  description: "Idempotent: succeeds even without a valid session.",
  security: [{ [refreshCookie.name]: [] }],
  responses: { 200: ok("Logged out", responses.message) },
});
registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "The authenticated user",
  security: authed,
  responses: { 200: ok("Current user", responses.user), 401: common[401] },
});

// --- Tasks --------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/tasks",
  tags: ["Tasks"],
  summary: "List your tasks (newest first, paginated)",
  security: authed,
  request: { query: listTasksQuerySchema },
  responses: { 200: ok("A page of tasks", responses.taskList), 401: common[401], 422: common[422] },
});
registry.registerPath({
  method: "post",
  path: "/tasks",
  tags: ["Tasks"],
  summary: "Create a task (always PENDING, owned by the caller)",
  description: "Unknown fields such as `userId` or `status` are rejected with 422.",
  security: authed,
  request: { body: { content: json(createTaskSchema) } },
  responses: { 201: ok("Created", responses.task), 401: common[401], 422: common[422] },
});
registry.registerPath({
  method: "get",
  path: "/tasks/{id}",
  tags: ["Tasks"],
  summary: "Get one of your tasks",
  security: authed,
  request: { params: taskIdParams },
  responses: { 200: ok("The task", responses.task), 401: common[401], 404: common.taskNotFound },
});
registry.registerPath({
  method: "patch",
  path: "/tasks/{id}",
  tags: ["Tasks"],
  summary: "Update title, description, and/or status",
  description:
    "At least one field. Status moves: PENDING→IN_PROGRESS/COMPLETED, IN_PROGRESS→PENDING/COMPLETED, COMPLETED→IN_PROGRESS. `completedAt` is set by the server on completion and cleared on reopen. Completing a task also stops its running timer, if any, at the completion time.",
  security: authed,
  request: { params: taskIdParams, body: { content: json(updateTaskSchema) } },
  responses: {
    200: ok("Updated", responses.task),
    401: common[401],
    404: common.taskNotFound,
    409: err("Status change not allowed", ["INVALID_STATUS_TRANSITION"]),
    422: common[422],
  },
});
registry.registerPath({
  method: "delete",
  path: "/tasks/{id}",
  tags: ["Tasks"],
  summary: "Delete a task and its time logs",
  security: authed,
  request: { params: taskIdParams },
  responses: {
    204: { description: "Deleted (no body)" },
    401: common[401],
    404: common.taskNotFound,
  },
});
registry.registerPath({
  method: "post",
  path: "/tasks/suggest",
  tags: ["Tasks", "AI"],
  summary: "Suggest a structured task from natural language (does not create it)",
  description:
    "Optional AI assistance. Returns a suggestion only; create the task with POST /tasks. Rate-limited per user.",
  security: authed,
  request: { body: { content: json(suggestTaskBodySchema) } },
  responses: {
    200: ok("Suggestion", responses.suggestion),
    401: common[401],
    422: err("Invalid input, or the model declined it", ["VALIDATION_ERROR", "AI_REFUSED"]),
    429: err("Rate limited (ours or the provider's)", ["TOO_MANY_REQUESTS", "AI_RATE_LIMITED"]),
    502: err("Provider failure or unusable output", [
      "AI_PROVIDER_UNAVAILABLE",
      "AI_INVALID_RESPONSE",
    ]),
    503: err("AI not configured/available", ["AI_CONFIGURATION_ERROR"]),
    504: err("Provider timed out", ["AI_REQUEST_TIMEOUT"]),
  },
});

// --- Time tracking ------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/tasks/{taskId}/timer/start",
  tags: ["Time tracking"],
  summary: "Start a timer on your task",
  description:
    "No body: the server sets startedAt. Moves a PENDING task to IN_PROGRESS. One running timer per user.",
  security: authed,
  request: { params: timerParams },
  responses: {
    201: ok("Timer started", responses.activeTimer),
    401: common[401],
    404: common.taskNotFound,
    409: err("A timer is already running, or the task is completed", [
      "ACTIVE_TIMER_EXISTS",
      "INVALID_TIMER_STATE",
    ]),
    422: err("A body was sent (timestamps/durations are server-controlled)", ["VALIDATION_ERROR"]),
  },
});
registry.registerPath({
  method: "post",
  path: "/tasks/{taskId}/timer/stop",
  tags: ["Time tracking"],
  summary: "Stop the timer running on your task",
  description: "The server sets stoppedAt and computes durationSeconds.",
  security: authed,
  request: { params: timerParams },
  responses: {
    200: ok("Completed time log", responses.timeLog),
    401: common[401],
    404: err("Task not found, or no timer running on it", [
      "TASK_NOT_FOUND",
      "ACTIVE_TIMER_NOT_FOUND",
    ]),
    409: err("Stopped concurrently by another request", ["TIMER_ALREADY_STOPPED"]),
  },
});
registry.registerPath({
  method: "get",
  path: "/tasks/{taskId}/time-logs",
  tags: ["Time tracking"],
  summary: "A task's sessions and total tracked time",
  security: authed,
  request: { params: timerParams, query: paginationQuerySchema },
  responses: {
    200: ok("Sessions (newest first) + SUM of completed durations", responses.taskTimeLogs),
    401: common[401],
    404: common.taskNotFound,
    422: common[422],
  },
});
registry.registerPath({
  method: "get",
  path: "/time-logs",
  tags: ["Time tracking"],
  summary: "Your sessions across tasks",
  description: "`from` (inclusive) / `to` (exclusive) filter on startedAt; ISO-8601 with timezone.",
  security: authed,
  request: { query: listTimeLogsQueryFields },
  responses: {
    200: ok("A page of sessions", responses.timeLogList),
    401: common[401],
    422: common[422],
  },
});
registry.registerPath({
  method: "get",
  path: "/time-logs/active",
  tags: ["Time tracking"],
  summary: "Your running timer, or null",
  security: authed,
  responses: {
    200: ok("Running timer or `data: null`", responses.activeTimerOrNull),
    401: common[401],
  },
});

// --- Dashboard ----------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/dashboard/daily-summary",
  tags: ["Dashboard"],
  summary: "Daily productivity summary",
  description:
    "Aggregated in PostgreSQL. `date` defaults to today in `timezone` (default APP_TIMEZONE). Logs crossing midnight are split between days.",
  security: authed,
  request: { query: dailySummaryQuerySchema },
  responses: {
    200: ok("Summary", responses.dailySummary),
    401: common[401],
    422: err("Invalid date/timezone, or a future date", ["VALIDATION_ERROR", "DATE_IN_FUTURE"]),
  },
});
registry.registerPath({
  method: "get",
  path: "/dashboard/weekly-summary",
  tags: ["Dashboard"],
  summary: "Weekly productivity summary",
  description:
    "Monday → Sunday, aggregated in PostgreSQL. `startDate` may be any day of the week (default: this week in `timezone`, default APP_TIMEZONE). `dailyBreakdown` always has 7 entries; logs crossing midnight are split between days.",
  security: authed,
  request: { query: weeklySummaryQuerySchema },
  responses: {
    200: ok("Summary", responses.weeklySummary),
    401: common[401],
    422: err("Invalid date/timezone, or a future week", ["VALIDATION_ERROR", "DATE_IN_FUTURE"]),
  },
});

/** The OpenAPI 3 document for /api/v1. Generated once at startup. */
export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Task & Time Tracker API",
      version: "1.0.0",
      description: [
        "All responses use `{ success: true, data }` or `{ success: false, error: { code, message, details?, requestId? } }`.",
        "Every response carries an `X-Request-ID` header. Authenticated endpoints read the `access_token` HttpOnly cookie;",
        "browsers must send requests with credentials from an allowed origin. Every resource is scoped to the caller.",
      ].join(" "),
    },
    servers: [{ url: "/api/v1" }],
  });
}
