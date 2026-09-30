import request from "supertest";
import type { z } from "zod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { ErrorResponse, responses } from "../../src/docs/openapi.schemas";
import { prisma } from "../../src/lib/prisma";
import { AUTH, createAuthedUser, resetDatabase, type AuthedUser } from "../helpers";

// Parses real responses with the schemas published in the OpenAPI document, so
// the docs can't silently drift from what the API actually returns.

const app = createApp();
const V1 = "/api/v1";

function expectShape(schema: z.ZodTypeAny, body: unknown) {
  const result = schema.safeParse(body);
  expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
}

let user: AuthedUser;
let taskId: string;

beforeEach(async () => {
  await resetDatabase();
  user = await createAuthedUser(app, "contract@example.com");
  const created = await request(app)
    .post(`${V1}/tasks`)
    .set("Cookie", user.cookie)
    .send({ title: "Contract task", description: "Checks the docs" });
  taskId = created.body.data.task.id;
});
afterAll(() => prisma.$disconnect());

const get = (path: string) => request(app).get(`${V1}${path}`).set("Cookie", user.cookie);
const post = (path: string, body?: object) => {
  const req = request(app).post(`${V1}${path}`).set("Cookie", user.cookie);
  return body ? req.send(body) : req;
};

describe("documented response schemas match real responses", () => {
  it("auth", async () => {
    expectShape(responses.user, (await get(`/auth/me`)).body);
    const login = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: "contract@example.com", password: "correct-horse-battery" });
    expectShape(responses.user, login.body);
    expectShape(responses.message, (await request(app).post(`${AUTH}/logout`)).body);
  });

  it("tasks", async () => {
    expectShape(responses.taskList, (await get(`/tasks`)).body);
    expectShape(responses.task, (await get(`/tasks/${taskId}`)).body);
    const updated = await request(app)
      .patch(`${V1}/tasks/${taskId}`)
      .set("Cookie", user.cookie)
      .send({ status: "COMPLETED" });
    expectShape(responses.task, updated.body);
  });

  it("time tracking", async () => {
    expectShape(responses.activeTimerOrNull, (await get(`/time-logs/active`)).body);
    expectShape(responses.activeTimer, (await post(`/tasks/${taskId}/timer/start`)).body);
    expectShape(responses.activeTimerOrNull, (await get(`/time-logs/active`)).body);
    expectShape(responses.timeLog, (await post(`/tasks/${taskId}/timer/stop`)).body);
    expectShape(responses.timeLogList, (await get(`/time-logs`)).body);
    expectShape(responses.taskTimeLogs, (await get(`/tasks/${taskId}/time-logs`)).body);
  });

  it("dashboard", async () => {
    await post(`/tasks/${taskId}/timer/start`);
    expectShape(responses.dailySummary, (await get(`/dashboard/daily-summary`)).body);
    expectShape(responses.weeklySummary, (await get(`/dashboard/weekly-summary`)).body);
  });

  it("errors", async () => {
    for (const res of [
      await request(app).get(`${V1}/tasks`), // 401
      await get(`/tasks/00000000-0000-4000-8000-000000000000`), // 404
      await post(`/tasks`, { title: "" }), // 422 with details
      await post(`/tasks/${taskId}/timer/stop`), // 404 ACTIVE_TIMER_NOT_FOUND
    ]) {
      expectShape(ErrorResponse, res.body);
    }
  });
});
