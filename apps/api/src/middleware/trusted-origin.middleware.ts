import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../lib/app-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense-in-depth for cookie-authenticated requests: browsers always
 * attach an Origin header to cross-origin state-changing requests, so any
 * such request from an origin other than the frontend is rejected. Requests
 * without an Origin (curl, server-to-server) carry no ambient browser
 * cookies and are allowed through.
 */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.get("origin");

  if (!SAFE_METHODS.has(req.method) && origin && !env.FRONTEND_ORIGINS.includes(origin)) {
    next(new AppError(403, "FORBIDDEN_ORIGIN", "Request origin is not allowed"));
    return;
  }

  next();
}
