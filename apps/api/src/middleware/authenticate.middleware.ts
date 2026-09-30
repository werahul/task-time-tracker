import type { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_COOKIE, readCookie } from "../modules/auth/auth.cookies";
import { AuthErrors } from "../modules/auth/auth.errors";
import { verifyAccessToken } from "../modules/auth/auth.tokens";
import type { AuthenticatedUser } from "../modules/auth/auth.types";

/**
 * Establishes *who* the caller is from the access-token cookie. It makes no
 * authorization decisions — resource ownership checks belong to each module.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = readCookie(req, ACCESS_TOKEN_COOKIE);
  if (!token) throw AuthErrors.authenticationRequired();

  const { userId } = verifyAccessToken(token);
  req.user = { id: userId };
  next();
}

/** Returns the authenticated user, for handlers mounted behind `authenticate`. */
export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AuthErrors.authenticationRequired();
  return req.user;
}
