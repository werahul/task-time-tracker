import { Router } from "express";
import { env } from "../config/env";
import { authRouter } from "../modules/auth/auth.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { aiTaskRouter } from "../modules/tasks/ai/ai-task.routes";
import { taskRouter } from "../modules/tasks/task.routes";
import { taskTimerRouter, timeLogRouter } from "../modules/time-tracking/time-tracking.routes";
import { docsRouter } from "./docs.route";
import { healthRouter } from "./health.route";

export const v1Router = Router();

v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
// Before /tasks/:taskId, so "/tasks/suggest" isn't read as a task id.
v1Router.use("/tasks", aiTaskRouter);
v1Router.use("/tasks/:taskId", taskTimerRouter);
v1Router.use("/tasks", taskRouter);
v1Router.use("/time-logs", timeLogRouter);
v1Router.use("/dashboard", dashboardRouter);

// /openapi.json and /docs — off by default in production (API_DOCS_ENABLED).
if (env.API_DOCS_ENABLED) {
  v1Router.use(docsRouter);
}
