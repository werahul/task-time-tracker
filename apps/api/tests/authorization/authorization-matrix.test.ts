import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { createAuthedUser, resetDatabase, type AuthedUser } from "../helpers";

/**
 * Every task-scoped endpoint, in both directions: an owner is allowed; a
 * non-owner gets a 404 indistinguishable from a task that doesn't exist, and
 * the owner's data is left untouched. Collection and aggregate endpoints only
 * ever return the caller's own data.
 */

const app = createApp();
const V1 = "/api/v1";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

interface Fixture {
  user: AuthedUser;
  taskId: string;
  title: string;
}

const users: Record<"A" | "B", Fixture> = {} as Record<"A" | "B", Fixture>;

async function setupUser(label: "A" | "B"): Promise<Fixture> {
  const user = await createAuthedUser(app, `authz.${label.toLowerCase()}@example.com`);
  const title = `User ${label}'s private task`;
  const created = await request(app)
    .post(`${V1}/tasks`)
    .set("Cookie", user.cookie)
    .send({ title, description: `${label} only` });
  const taskId = created.body.data.task.id as string;
  // A completed session so logs and totals exist.
  const start = new Date(Date.now() - 2 * 3600_000);
  await prisma.timeLog.create({
    data: {
      userId: user.id,
      taskId,
      startedAt: start,
      stoppedAt: new Date(start.getTime() + 1800_000),
      durationSeconds: 1800,
    },
  });
  return { user, taskId, title };
}

type Op = (actor: AuthedUser, taskId: string) => request.Test;

const taskOperations: [string, Op][] = [
  ["GET /tasks/:id", (a, id) => request(app).get(`${V1}/tasks/${id}`).set("Cookie", a.cookie)],
  [
    "PATCH /tasks/:id",
    (a, id) =>
      request(app).patch(`${V1}/tasks/${id}`).set("Cookie", a.cookie).send({ title: "Hijacked" }),
  ],
  [
    "GET /tasks/:id/time-logs",
    (a, id) => request(app).get(`${V1}/tasks/${id}/time-logs`).set("Cookie", a.cookie),
  ],
  [
    "POST /tasks/:id/timer/start",
    (a, id) => request(app).post(`${V1}/tasks/${id}/timer/start`).set("Cookie", a.cookie),
  ],
  [
    "POST /tasks/:id/timer/stop",
    (a, id) => request(app).post(`${V1}/tasks/${id}/timer/stop`).set("Cookie", a.cookie),
  ],
  [
    "DELETE /tasks/:id",
    (a, id) => request(app).delete(`${V1}/tasks/${id}`).set("Cookie", a.cookie),
  ],
];

async function snapshot(owner: Fixture) {
  const [task, logs, running] = await Promise.all([
    prisma.task.findUnique({ where: { id: owner.taskId } }),
    prisma.timeLog.count({ where: { taskId: owner.taskId } }),
    prisma.timeLog.count({ where: { userId: owner.user.id, stoppedAt: null } }),
  ]);
  return { title: task?.title, status: task?.status, logs, running };
}

beforeEach(async () => {
  await resetDatabase();
  users.A = await setupUser("A");
  users.B = await setupUser("B");
});
afterAll(() => prisma.$disconnect());

describe.each([
  ["A", "B"],
  ["B", "A"],
] as const)("user %s acting on user %s's task", (actorLabel, ownerLabel) => {
  it.each(taskOperations)(
    "%s → 404, indistinguishable from a missing task; owner unchanged",
    async (_name, op) => {
      const actor = users[actorLabel].user;
      const owner = users[ownerLabel];
      // Give the owner a running timer so "stop" has something to (not) stop.
      await request(app)
        .post(`${V1}/tasks/${owner.taskId}/timer/start`)
        .set("Cookie", owner.user.cookie);
      const before = await snapshot(owner);

      const res = await op(actor, owner.taskId);
      const missing = await op(actor, MISSING_ID);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TASK_NOT_FOUND");
      expect({
        status: res.status,
        code: res.body.error.code,
        message: res.body.error.message,
      }).toEqual({
        status: missing.status,
        code: missing.body.error.code,
        message: missing.body.error.message,
      });
      expect(JSON.stringify(res.body)).not.toContain(owner.title);
      expect(await snapshot(owner)).toEqual(before);
      // The actor gained no timer from someone else's task.
      expect(await prisma.timeLog.count({ where: { userId: actor.id, stoppedAt: null } })).toBe(0);
    },
  );
});

describe.each(["A", "B"] as const)("user %s acting on their own task", (label) => {
  it("is allowed for every operation", async () => {
    const { user, taskId } = users[label];
    const expected: Record<string, number> = {
      "GET /tasks/:id": 200,
      "PATCH /tasks/:id": 200,
      "GET /tasks/:id/time-logs": 200,
      "POST /tasks/:id/timer/start": 201,
      "POST /tasks/:id/timer/stop": 200,
      "DELETE /tasks/:id": 204,
    };

    for (const [name, op] of taskOperations) {
      expect((await op(user, taskId)).status, name).toBe(expected[name]);
    }
  });
});

describe("collections and aggregates only contain the caller's data", () => {
  it.each(["A", "B"] as const)("user %s", async (label) => {
    const self = users[label];
    const other = users[label === "A" ? "B" : "A"];
    await request(app)
      .post(`${V1}/tasks/${other.taskId}/timer/start`)
      .set("Cookie", other.user.cookie);
    const as = (path: string) => request(app).get(`${V1}${path}`).set("Cookie", self.user.cookie);

    const tasks = await as("/tasks");
    const logs = await as("/time-logs?limit=100");
    const filtered = await as(`/time-logs?taskId=${other.taskId}`);
    const active = await as("/time-logs/active");
    const summary = await as("/dashboard/daily-summary?timezone=UTC");
    const weekly = await as("/dashboard/weekly-summary?timezone=UTC");

    expect(tasks.body.data.items.map((t: { id: string }) => t.id)).toEqual([self.taskId]);
    expect(logs.body.data.items.every((l: { taskId: string }) => l.taskId === self.taskId)).toBe(
      true,
    );
    expect(filtered.body.data.pagination.total).toBe(0);
    expect(active.body.data).toBeNull();
    expect(summary.body.data).toMatchObject({
      tasksWorkedOn: 1,
      activeTimer: null,
      pendingTasks: 1,
    });
    expect(summary.body.data.totalTrackedSeconds).toBe(1800);
    // Only the caller's task can appear (whichever week the fixture log fell in).
    expect(weekly.body.data.tasksWorkedOn).toBeLessThanOrEqual(1);
    expect(
      weekly.body.data.topTasks.every((t: { taskId: string }) => t.taskId === self.taskId),
    ).toBe(true);
    for (const res of [tasks, logs, filtered, active, summary, weekly]) {
      expect(JSON.stringify(res.body)).not.toContain(other.title);
    }
  });
});
