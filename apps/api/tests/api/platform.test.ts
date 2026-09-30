import { Prisma } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { lifecycle } from "../../src/lib/lifecycle";
import { prisma } from "../../src/lib/prisma";
import { taskRepository } from "../../src/modules/tasks/task.repository";
import { createAuthedUser, resetDatabase } from "../helpers";

const app = createApp();

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

describe("request ids", () => {
  it("adds an X-Request-ID to every response", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("propagates a safe upstream X-Request-ID", async () => {
    const res = await request(app).get("/api/v1/health").set("X-Request-ID", "lb-trace-12345678");

    expect(res.headers["x-request-id"]).toBe("lb-trace-12345678");
  });

  it.each([
    ["markup", "<script>alert(1)</script>"],
    ["spaces", "has some spaces in it"],
    ["too short", "abc"],
    ["too long", "a".repeat(200)],
  ])("replaces an unsafe upstream X-Request-ID (%s)", async (_case, value) => {
    const res = await request(app).get("/api/v1/health").set("X-Request-ID", value);

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("includes the same id in error bodies", async () => {
    const res = await request(app).get("/api/v1/nope");

    expect(res.status).toBe(404);
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});

describe("error responses never leak internals", () => {
  it("turns a database error into a generic 500 with a request id", async () => {
    const user = await createAuthedUser(app, "leak@example.com");
    vi.spyOn(taskRepository, "findTasksByUser").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Invalid `prisma.task.findMany()` invocation in D:\\app\\src\\repo.ts: column "Task"."secret" does not exist (SELECT * FROM "Task")',
        { code: "P2022", clientVersion: "6.19.3" },
      ),
    );

    const res = await request(app).get("/api/v1/tasks").set("Cookie", user.cookie);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again.",
        requestId: res.headers["x-request-id"],
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|SELECT|column|P2022|D:\\\\|stack/i);
  });

  it("answers unknown routes with the standard 404 envelope", async () => {
    const res = await request(app).delete("/api/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("request limits", () => {
  it("rejects JSON bodies over 10kb with 413", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@example.com", password: "x".repeat(20_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("rejects URLs over 2048 characters with 414", async () => {
    const res = await request(app).get(`/api/v1/tasks?status=${"x".repeat(2100)}`);

    expect(res.status).toBe(414);
    expect(res.body.error.code).toBe("URI_TOO_LONG");
  });

  it("does not parse form-encoded bodies", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .type("form")
      .send({ email: "a@example.com", password: "whatever-123" });

    expect(res.status).toBe(422);
  });

  it("answers a malformed URL encoding with 400, not 500", async () => {
    const res = await request(app).get("/api/v1/tasks/%E0%A4%A");

    expect([400, 401, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe("security headers", () => {
  it("sets a locked-down header set on API responses", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    // HSTS is production-only (tests run as NODE_ENV=test).
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("exposes the request id header to browsers via CORS", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-expose-headers"]).toContain("X-Request-ID");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("never grants CORS to an unlisted origin", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("health checks", () => {
  it("liveness answers without touching dependencies", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw");
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data).toHaveProperty("commit"); // null locally; the short SHA when deployed
    expect(spy).not.toHaveBeenCalled();
  });

  it("readiness checks the database", async () => {
    const res = await request(app).get("/api/v1/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "ready", checks: { database: "ok" } });
  });

  it("readiness reports 503 when the database is down, without details", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 10.0.0.5:5432"),
    );

    const res = await request(app).get("/api/v1/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|5432/);
  });

  it("readiness reports 503 while shutting down", async () => {
    vi.spyOn(lifecycle, "isShuttingDown").mockReturnValue(true);

    const res = await request(app).get("/api/v1/health/ready");
    expect(res.status).toBe(503);
  });
});

describe("API documentation", () => {
  it("serves an OpenAPI 3 document covering every endpoint", async () => {
    const res = await request(app).get("/api/v1/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    const operations = Object.entries(res.body.paths as Record<string, object>).flatMap(
      ([path, methods]) => Object.keys(methods).map((m) => `${m.toUpperCase()} ${path}`),
    );
    expect(operations).toEqual(
      expect.arrayContaining([
        "POST /auth/register",
        "POST /auth/login",
        "POST /auth/logout",
        "POST /auth/refresh",
        "GET /auth/me",
        "GET /tasks",
        "POST /tasks",
        "GET /tasks/{id}",
        "PATCH /tasks/{id}",
        "DELETE /tasks/{id}",
        "POST /tasks/suggest",
        "POST /tasks/{taskId}/timer/start",
        "POST /tasks/{taskId}/timer/stop",
        "GET /tasks/{taskId}/time-logs",
        "GET /time-logs",
        "GET /time-logs/active",
        "GET /dashboard/daily-summary",
        "GET /health",
        "GET /health/ready",
      ]),
    );
    expect(res.body.components.securitySchemes.cookieAuth).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: "access_token",
    });
  });

  it("serves Swagger UI under a CSP scoped to the docs route", async () => {
    const res = await request(app).get("/api/v1/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
    expect(res.headers["content-security-policy"]).toContain("script-src 'self'");
  });
});
