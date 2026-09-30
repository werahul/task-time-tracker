import type { NextFunction, Request, Response } from "express";
import type { z, ZodError, ZodTypeAny } from "zod";
import type { ApiFieldErrors } from "@task-time-tracker/shared";
import { AppError } from "../lib/app-error";

/** Field path → messages. Object-level errors are keyed "root"; unknown keys by their name. */
function toFieldErrors(error: ZodError): ApiFieldErrors {
  const details: ApiFieldErrors = {};
  const add = (field: string, message: string) => (details[field] ??= []).push(message);

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      issue.keys.forEach((key) => add(key, "Unknown field"));
    } else {
      add(issue.path.length > 0 ? issue.path.join(".") : "root", issue.message);
    }
  }
  return details;
}

/** Parses `data` or throws a 422 VALIDATION_ERROR with per-field details. */
export function parseOrThrow<T extends ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "Invalid request data",
      toFieldErrors(result.error),
    );
  }
  return result.data;
}

/**
 * Validates route params before any handler runs. `onInvalid` lets a resource
 * answer as "not found" instead of 422 (a malformed id can't name a resource).
 */
export function validateParams(schema: ZodTypeAny, onInvalid?: () => AppError) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (onInvalid && !schema.safeParse(req.params).success) throw onInvalid();
    parseOrThrow(schema, req.params);
    next();
  };
}

/** Validates req.body and replaces it with the parsed (normalized) value. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = parseOrThrow(schema, req.body);
    next();
  };
}
