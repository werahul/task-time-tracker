import type { ApiFieldErrors } from "@task-time-tracker/shared";

/** An expected, client-safe error. Its code and message are sent to the client as-is. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}
