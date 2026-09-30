import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { logger } from "../lib/logger";
import { sendError } from "../utils/api-response";

interface HttpLikeError {
  status: number;
  type?: string;
}

/** Errors raised by Express/body-parser carry a numeric `status` (and sometimes `type`). */
function isHttpLikeError(err: unknown): err is HttpLikeError {
  return (
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
  );
}

function isDatabaseError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientValidationError
  );
}

/**
 * The single place errors become responses. Expected errors (AppError) keep
 * their code and message; everything else becomes a generic 500. Prisma/SQL
 * details, stack traces, paths, and provider messages are logged server-side
 * (with the requestId) and never sent to clients — in any environment.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (isHttpLikeError(err) && err.status >= 400 && err.status < 500) {
    if (err.type === "entity.parse.failed") {
      sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
    } else if (err.type === "entity.too.large") {
      sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    } else if (err.type === "encoding.unsupported" || err.type === "charset.unsupported") {
      sendError(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported request encoding");
    } else {
      sendError(res, 400, "BAD_REQUEST", "The request could not be understood");
    }
    return;
  }

  if (isDatabaseError(err)) {
    logger.error({ event: "database.failure", err }, "Database failure");
  } else {
    logger.error({ event: "error.unhandled", err }, "Unhandled error");
  }
  sendError(res, 500, "INTERNAL_SERVER_ERROR", "Something went wrong. Please try again.");
}
