import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

/**
 * One structured line per request: method, path (no query string), status,
 * duration. Headers, cookies, and bodies are never logged. "request started"
 * is at debug level to keep default output to one line per request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  const path = req.originalUrl.split("?")[0];

  logger.debug({ method: req.method, path }, "request started");

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const entry = {
      method: req.method,
      path,
      route: req.route?.path ? `${req.baseUrl}${req.route.path}` : undefined,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
    };
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](entry, "request completed");
  });

  next();
}
