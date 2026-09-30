import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/lib/prisma";
import { sessionRepository } from "../../src/modules/auth/auth.repository";
import { hashRefreshToken } from "../../src/modules/auth/auth.tokens";
import {
  AUTH,
  getCookieValue,
  isClearedCookie,
  registerUser,
  resetDatabase,
  testUser,
} from "../helpers";

const app = createApp();

const me = (accessToken?: string) => {
  const req = request(app).get(`${AUTH}/me`);
  return accessToken ? req.set("Cookie", `access_token=${accessToken}`) : req;
};
const refresh = (refreshToken: string) =>
  request(app).post(`${AUTH}/refresh`).set("Cookie", `refresh_token=${refreshToken}`);
const logout = (refreshToken?: string) => {
  const req = request(app).post(`${AUTH}/logout`);
  return refreshToken ? req.set("Cookie", `refresh_token=${refreshToken}`) : req;
};

function signAccessToken(payload: object, secret = env.ACCESS_TOKEN_SECRET) {
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("GET /auth/me", () => {
  it("returns the authenticated user for a valid access token", async () => {
    const { userId, accessToken } = await registerUser(app);
    const res = await me(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: userId, name: testUser.name, email: testUser.email });
  });

  it("requires an access token", async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects an expired access token with a distinguishable code", async () => {
    const { userId } = await registerUser(app);
    const expired = signAccessToken({
      sub: userId,
      type: "access",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("ACCESS_TOKEN_EXPIRED");
  });

  it("rejects a token signed with a different secret", async () => {
    const { userId } = await registerUser(app);
    const forged = signAccessToken(
      { sub: userId, type: "access" },
      "attacker-controlled-secret-at-least-32-chars",
    );

    const res = await me(forged);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("rejects a garbage token", async () => {
    const res = await me("not.a.jwt");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("rejects a correctly signed token that is not an access token", async () => {
    const { userId } = await registerUser(app);
    const wrongType = signAccessToken({ sub: userId, type: "refresh" });

    const res = await me(wrongType);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("treats a valid token for a deleted user as unauthenticated", async () => {
    const { userId, accessToken } = await registerUser(app);
    await prisma.user.delete({ where: { id: userId } });

    const res = await me(accessToken);
    expect(res.status).toBe(401);
  });

  it("puts only the user id and token type in the access token", async () => {
    const { userId, accessToken } = await registerUser(app);
    const payload = jwt.decode(accessToken) as Record<string, unknown>;

    expect(payload.sub).toBe(userId);
    expect(payload.type).toBe("access");
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "sub", "type"]);
  });
});

describe("POST /auth/refresh", () => {
  it("rotates: issues new tokens, revokes the old session, and creates a new one", async () => {
    const { userId, refreshToken: tokenA } = await registerUser(app);

    const res = await refresh(tokenA);
    const tokenB = getCookieValue(res, "refresh_token");

    expect(res.status).toBe(200);
    expect(tokenB).toBeTruthy();
    expect(tokenB).not.toBe(tokenA);
    expect(getCookieValue(res, "access_token")).toBeTruthy();

    const oldSession = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(tokenA) },
    });
    const newSession = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(tokenB ?? "") },
    });
    expect(oldSession.revokedAt).not.toBeNull();
    expect(newSession.revokedAt).toBeNull();
    expect(newSession.userId).toBe(userId);
  });

  it("issues an access token that works on protected routes", async () => {
    const { refreshToken } = await registerUser(app);
    const res = await refresh(refreshToken);

    const meRes = await me(getCookieValue(res, "access_token"));
    expect(meRes.status).toBe(200);
  });

  it("refuses to reuse a rotated refresh token and clears cookies", async () => {
    const { refreshToken: tokenA } = await registerUser(app);
    await refresh(tokenA);

    const reuse = await refresh(tokenA);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    expect(isClearedCookie(reuse, "access_token")).toBe(true);
    expect(isClearedCookie(reuse, "refresh_token")).toBe(true);
  });

  it("lets only one of two concurrent refreshes with the same token succeed", async () => {
    const { refreshToken } = await registerUser(app);

    const results = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([200, 401]);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
  });

  it("rejects an expired session", async () => {
    const { refreshToken } = await registerUser(app);
    await prisma.session.update({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await refresh(refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("rejects an unknown refresh token", async () => {
    const res = await refresh("made-up-token");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects a request with no refresh cookie", async () => {
    const res = await request(app).post(`${AUTH}/refresh`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});

describe("POST /auth/logout", () => {
  it("revokes the session and clears both cookies", async () => {
    const { refreshToken } = await registerUser(app);

    const res = await logout(refreshToken);

    expect(res.status).toBe(200);
    expect(isClearedCookie(res, "access_token")).toBe(true);
    expect(isClearedCookie(res, "refresh_token")).toBe(true);
    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    expect(session.revokedAt).not.toBeNull();
  });

  it("prevents the logged-out refresh token from being used again", async () => {
    const { refreshToken } = await registerUser(app);
    await logout(refreshToken);

    const res = await refresh(refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("succeeds even without a session (idempotent)", async () => {
    expect((await logout()).status).toBe(200);
    expect((await logout("unknown-token")).status).toBe(200);
  });
});

describe("CSRF / CORS origin policy", () => {
  it("rejects state-changing requests from an untrusted Origin", async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .set("Origin", "https://evil.example")
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("allows state-changing requests from the configured frontend origin", async () => {
    await registerUser(app);
    const res = await request(app)
      .post(`${AUTH}/login`)
      .set("Origin", env.FRONTEND_ORIGINS[0])
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
  });

  it("only grants credentialed CORS to the configured frontend origin", async () => {
    const allowed = await request(app)
      .options(`${AUTH}/login`)
      .set("Origin", env.FRONTEND_ORIGINS[0])
      .set("Access-Control-Request-Method", "POST");
    const denied = await request(app)
      .options(`${AUTH}/login`)
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST");

    expect(allowed.headers["access-control-allow-origin"]).toBe(env.FRONTEND_ORIGINS[0]);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    // Never a wildcard and never a reflected foreign origin, so browsers block
    // the cross-origin read for evil.example.
    expect(denied.headers["access-control-allow-origin"]).not.toBe("*");
    expect(denied.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
  });
});

describe("session cleanup", () => {
  it("deletes expired and revoked sessions but keeps active ones", async () => {
    const { refreshToken: active } = await registerUser(app);
    const { refreshToken: revoked } = await registerUser(app, { email: "second@example.com" });
    const { refreshToken: expired } = await registerUser(app, { email: "third@example.com" });

    await logout(revoked);
    await prisma.session.update({
      where: { tokenHash: hashRefreshToken(expired) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await sessionRepository.deleteExpiredAndRevoked()).toBe(2);
    const remaining = await prisma.session.findMany();
    expect(remaining.map((s) => s.tokenHash)).toEqual([hashRefreshToken(active)]);
  });
});
