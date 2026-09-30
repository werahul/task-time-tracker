import pino from "pino";
import { env } from "../config/env";
import { currentRequestId } from "./request-context";

/**
 * Structured JSON logger. Every line automatically carries the current
 * requestId. Callers log event names and ids — never passwords, tokens,
 * cookies, API keys, or request bodies. The redact list is a safety net for
 * those field names, not a license to log them.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "task-time-tracker-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: () => {
    const requestId = currentRequestId();
    return requestId ? { requestId } : {};
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",
      "*.password",
      "*.passwordHash",
      "*.accessToken",
      "*.refreshToken",
      "*.apiKey",
      "req.headers.cookie",
      "req.headers.authorization",
      'res.headers["set-cookie"]',
    ],
    censor: "[REDACTED]",
  },
  // Human-readable output for local development only.
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss" } } }
    : {}),
});
