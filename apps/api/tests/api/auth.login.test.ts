import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import {
  withoutRequestId,
  AUTH,
  getCookieValue,
  registerUser,
  resetDatabase,
  testUser,
} from "../helpers";

const app = createApp();

function login(body: object) {
  return request(app).post(`${AUTH}/login`).send(body);
}

beforeEach(async () => {
  await resetDatabase();
  await registerUser(app);
});
afterAll(() => prisma.$disconnect());

describe("POST /auth/login", () => {
  it("logs in with valid credentials, returning safe user data and auth cookies", async () => {
    const res = await login({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      name: testUser.name,
      email: testUser.email,
    });
    expect(getCookieValue(res, "access_token")).toBeTruthy();
    expect(getCookieValue(res, "refresh_token")).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("creates a new session per login", async () => {
    await login({ email: testUser.email, password: testUser.password });

    // One from registration, one from this login.
    expect(await prisma.session.count()).toBe(2);
  });

  it("accepts the email in a different case", async () => {
    const res = await login({ email: testUser.email.toUpperCase(), password: testUser.password });

    expect(res.status).toBe(200);
  });

  it("rejects an incorrect password with a generic 401 and sets no cookies", async () => {
    const res = await login({ email: testUser.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(withoutRequestId(res.body).error).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("responds to an unknown email exactly like a wrong password", async () => {
    const wrongPassword = await login({ email: testUser.email, password: "wrong-password" });
    const unknownEmail = await login({ email: "nobody@example.com", password: "whatever-123" });

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(withoutRequestId(unknownEmail.body)).toEqual(withoutRequestId(wrongPassword.body));
  });

  it("rejects invalid input with 422", async () => {
    const res = await login({ email: "not-an-email" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(["email", "password"]),
    );
  });
});
