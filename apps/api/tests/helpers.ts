import request from "supertest";
import type { Application } from "express";
import { prisma } from "../src/lib/prisma";

export const AUTH = "/api/v1/auth";

export const testUser = {
  name: "Test User",
  email: "test.user@example.com",
  password: "correct-horse-battery",
};

/**
 * An error body minus its per-request `requestId`, for asserting that two
 * responses are otherwise identical (e.g. "someone else's task" vs "no such task").
 */
export function withoutRequestId(body: { error?: Record<string, unknown> }) {
  if (!body.error) return body;
  const { requestId: _requestId, ...error } = body.error;
  return { ...body, error };
}

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Session", "TimeLog", "Task", "User" CASCADE');
}

function setCookieHeaders(res: request.Response): string[] {
  const header: unknown = res.headers["set-cookie"];
  return Array.isArray(header) ? header.filter((h): h is string => typeof h === "string") : [];
}

/** The full Set-Cookie header line for `name`, including its attributes. */
export function getSetCookie(res: request.Response, name: string): string | undefined {
  return setCookieHeaders(res).find((cookie) => cookie.startsWith(`${name}=`));
}

export function getCookieValue(res: request.Response, name: string): string | undefined {
  const cookie = getSetCookie(res, name);
  if (!cookie) return undefined;
  const value = cookie.split(";")[0].slice(name.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}

export function isClearedCookie(res: request.Response, name: string): boolean {
  const cookie = getSetCookie(res, name);
  return cookie !== undefined && /Expires=Thu, 01 Jan 1970/i.test(cookie);
}

export interface AuthedUser {
  id: string;
  /** Ready-to-send Cookie header value carrying the access token. */
  cookie: string;
}

export async function createAuthedUser(app: Application, email: string): Promise<AuthedUser> {
  const { userId, accessToken } = await registerUser(app, { email });
  return { id: userId, cookie: `access_token=${accessToken}` };
}

export async function registerUser(app: Application, overrides: Partial<typeof testUser> = {}) {
  const res = await request(app)
    .post(`${AUTH}/register`)
    .send({ ...testUser, ...overrides });

  return {
    res,
    userId: res.body.data?.user?.id as string,
    accessToken: getCookieValue(res, "access_token") ?? "",
    refreshToken: getCookieValue(res, "refresh_token") ?? "",
  };
}
