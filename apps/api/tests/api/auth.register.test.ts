import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { hashRefreshToken } from "../../src/modules/auth/auth.tokens";
import { AUTH, getSetCookie, registerUser, resetDatabase, testUser } from "../helpers";

const app = createApp();

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("POST /auth/register", () => {
  it("creates the user and returns only safe fields with 201", async () => {
    const { res } = await registerUser(app);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { user: { id: expect.any(String), name: testUser.name, email: testUser.email } },
    });
  });

  it("normalizes the email (trim + lowercase)", async () => {
    const { res } = await registerUser(app, { email: "  Test.User@Example.COM " });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("test.user@example.com");
  });

  it("stores an Argon2id hash, never the plaintext password", async () => {
    const { userId } = await registerUser(app);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).not.toBe(testUser.password);
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("never returns the password or its hash", async () => {
    const { res, userId } = await registerUser(app);
    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain(passwordHash);
    expect(raw).not.toContain(testUser.password);
  });

  it("sets HttpOnly SameSite auth cookies, scoping the refresh cookie to /api/v1/auth", async () => {
    const { res } = await registerUser(app);

    const access = getSetCookie(res, "access_token");
    const refresh = getSetCookie(res, "refresh_token");
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Lax/);
    expect(access).toMatch(/Path=\/;/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
  });

  it("persists only the SHA-256 hash of the refresh token", async () => {
    const { userId, refreshToken } = await registerUser(app);

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashRefreshToken(refreshToken));
    expect(sessions[0].tokenHash).not.toBe(refreshToken);
    expect(sessions[0].revokedAt).toBeNull();
  });

  it("rejects an invalid email with 422 and a field error", async () => {
    const { res } = await registerUser(app, { email: "not-an-email" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.email).toBeDefined();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const { res } = await registerUser(app, { password: "short" });

    expect(res.status).toBe(422);
    expect(res.body.error.details.password).toBeDefined();
    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects a duplicate email (case-insensitively) with 409", async () => {
    await registerUser(app);
    const { res } = await registerUser(app, { email: testUser.email.toUpperCase() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(await prisma.user.count()).toBe(1);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .set("Content-Type", "application/json")
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("ignores a client-supplied id rather than trusting it", async () => {
    const { res } = await registerUser(app, {
      id: "00000000-0000-0000-0000-000000000000",
    } as Partial<typeof testUser>);

    expect(res.status).toBe(201);
    expect(res.body.data.user.id).not.toBe("00000000-0000-0000-0000-000000000000");
  });
});
