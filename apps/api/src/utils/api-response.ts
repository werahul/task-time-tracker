import type { Response } from "express";
import type {
  ApiErrorResponse,
  ApiFieldErrors,
  ApiSuccessResponse,
} from "@task-time-tracker/shared";
import { currentRequestId } from "../lib/request-context";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiSuccessResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ApiFieldErrors,
): void {
  const requestId = currentRequestId();
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };
  res.status(statusCode).json(body);
}
