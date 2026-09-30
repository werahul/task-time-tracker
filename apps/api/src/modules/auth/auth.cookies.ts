import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env";
import type { AuthTokens } from "./auth.types";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** Cookie attributes for a given environment (pure, so production flags are testable). */
export function buildAuthCookieOptions(config: {
  nodeEnv: string;
  sameSite: "lax" | "strict" | "none";
}): { access: CookieOptions; refresh: CookieOptions } {
  const base: CookieOptions = {
    httpOnly: true, // never readable from JavaScript
    secure: config.nodeEnv === "production", // HTTPS-only in production
    sameSite: config.sameSite,
  };
  return {
    access: { ...base, path: "/" },
    // The refresh token is only ever sent to the auth endpoints that consume it.
    refresh: { ...base, path: "/api/v1/auth" },
  };
}

const { access: accessCookieOptions, refresh: refreshCookieOptions } = buildAuthCookieOptions({
  nodeEnv: env.NODE_ENV,
  sameSite: env.COOKIE_SAME_SITE,
});

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...accessCookieOptions,
    maxAge: env.ACCESS_TOKEN_EXPIRES_IN * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...refreshCookieOptions,
    maxAge: env.REFRESH_TOKEN_EXPIRES_IN * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions);
}

export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
