import { Router } from "express";
import { lifecycle } from "../lib/lifecycle";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { sendError, sendSuccess } from "../utils/api-response";

const DATABASE_CHECK_TIMEOUT_MS = 2000;

export const healthRouter = Router();

/** Liveness: the process is up and serving HTTP. No dependency checks. */
healthRouter.get("/", (_req, res) => {
  sendSuccess(res, { status: "ok", message: "API is healthy" });
});

/**
 * Readiness: the process can serve real traffic (database reachable, not
 * shutting down). Reports only pass/fail — no hosts, versions, or error text.
 */
healthRouter.get("/ready", async (_req, res) => {
  if (lifecycle.isShuttingDown()) {
    sendError(res, 503, "SERVICE_UNAVAILABLE", "Service is shutting down");
    return;
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("database check timed out")),
          DATABASE_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
    sendSuccess(res, { status: "ready", checks: { database: "ok" } });
  } catch (err) {
    logger.error({ event: "health.not_ready", err }, "Readiness check failed");
    sendError(res, 503, "SERVICE_UNAVAILABLE", "Service is not ready");
  } finally {
    clearTimeout(timer);
  }
});
