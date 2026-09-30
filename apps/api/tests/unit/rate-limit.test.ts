import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../../src/middleware/rate-limit.middleware";

// Auth routes skip rate limiting under NODE_ENV=test so the suites above can
// make many requests; this exercises the limiter itself in isolation.
describe("createRateLimiter", () => {
  it("responds 429 with the standard error envelope once the limit is exceeded", async () => {
    const app = express();
    app.post(
      "/limited",
      createRateLimiter({ name: "test", windowMs: 60_000, limit: 2 }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );

    expect((await request(app).post("/limited")).status).toBe(200);
    expect((await request(app).post("/limited")).status).toBe(200);

    const blocked = await request(app).post("/limited");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: { code: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later" },
    });
  });
});
