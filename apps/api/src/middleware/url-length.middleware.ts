import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";

/** No endpoint needs long URLs; cap them to bound query-string parsing and logging. */
export const MAX_URL_LENGTH = 2048;

export function limitUrlLength(req: Request, _res: Response, next: NextFunction): void {
  if (req.originalUrl.length > MAX_URL_LENGTH) {
    throw new AppError(414, "URI_TOO_LONG", "Request URL is too long");
  }
  next();
}
