import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import {
  withoutRequestId,
  createAuthedUser,
  resetDatabase,
  type AuthedUser as TestUser,
} from "../helpers";

const app = createApp();
const TASKS = "/api/v1/tasks";
const NONEXISTENT_ID = "00000000-0000-4000-8000-000000000000";

const createUser = (email: string) => createAuthedUser(app, email);

const api = (user: TestUser) => ({
  list: (query = "") => request(app).get(`${TASKS}${query}`).set("Cookie", user.cookie),
  create: (body: object) => request(app).post(TASKS).set("Cookie", user.cookie).send(body),
  get: (id: string) => request(app).get(`${TASKS}/${id}`).set("Cookie", user.cookie),
  update: (id: string, body: object) =>
    request(app).patch(`${TASKS}/${id}`).set("Cookie", user.cookie).send(body),
  remove: (id: string) => request(app).delete(`${TASKS}/${id}`).set("Cookie", user.cookie),
});

async function createTask(user: TestUser, title: string): Promise<string> {
  const res = await api(user).create({ title, description: `${title} description` });
  expect(res.status).toBe(201);
  return res.body.data.task.id as string;
}

let userA: TestUser;
let userB: TestUser;

beforeEach(async () => {
  await resetDatabase();
  userA = await createUser("user.a@example.com");
  userB = await createUser("user.b@example.com");
});
afterAll(() => prisma.$disconnect());

describe("authentication requirement", () => {
  it.each([
    ["GET", TASKS],
    ["POST", TASKS],
    ["GET", `${TASKS}/${NONEXISTENT_ID}`],
    ["PATCH", `${TASKS}/${NONEXISTENT_ID}`],
    ["DELETE", `${TASKS}/${NONEXISTENT_ID}`],
  ])("%s %s returns 401 without an access token", async (method, path) => {
    const res = await request(app)[method.toLowerCase() as "get"](path).send({ title: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("POST /tasks", () => {
  it("creates a PENDING task owned by the caller and returns 201", async () => {
    const res = await api(userA).create({
      title: "  Follow up with designer  ",
      description: "Confirm wireframe delivery status",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.task).toEqual({
      id: expect.any(String),
      title: "Follow up with designer",
      description: "Confirm wireframe delivery status",
      status: "PENDING",
      completedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const row = await prisma.task.findUniqueOrThrow({ where: { id: res.body.data.task.id } });
    expect(row.userId).toBe(userA.id);
  });

  it("stores a blank description as null", async () => {
    const res = await api(userA).create({ title: "No details", description: "   " });

    expect(res.status).toBe(201);
    expect(res.body.data.task.description).toBeNull();
  });

  it("rejects a client-supplied userId and creates nothing (ownership injection)", async () => {
    const res = await api(userA).create({ title: "Injected ownership", userId: userB.id });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.userId).toEqual(["Unknown field"]);
    expect(await prisma.task.count()).toBe(0);
  });

  it("rejects attempts to set server-controlled fields", async () => {
    const res = await api(userA).create({
      title: "Sneaky",
      status: "COMPLETED",
      id: NONEXISTENT_ID,
    });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(["status", "id"]));
  });

  it.each([
    ["a missing title", {}],
    ["a whitespace-only title", { title: "   " }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
    ["a description over 2000 characters", { title: "ok", description: "x".repeat(2001) }],
    ["a non-string title", { title: 42 }],
  ])("rejects %s with 422", async (_case, body) => {
    const res = await api(userA).create(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toBeDefined();
  });
});

describe("GET /tasks", () => {
  it("returns only the caller's tasks, newest first", async () => {
    await createTask(userA, "A first");
    await createTask(userB, "B only");
    await createTask(userA, "A second");

    const res = await api(userA).list();

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((t: { title: string }) => t.title)).toEqual([
      "A second",
      "A first",
    ]);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("filters by status", async () => {
    const id = await createTask(userA, "Started");
    await createTask(userA, "Not started");
    await api(userA).update(id, { status: "IN_PROGRESS" });

    const res = await api(userA).list("?status=IN_PROGRESS");

    expect(res.body.data.items.map((t: { title: string }) => t.title)).toEqual(["Started"]);
    expect(res.body.data.pagination.total).toBe(1);
  });

  it("paginates in the database with correct metadata", async () => {
    const base = Date.now();
    await prisma.task.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: userA.id,
        title: `Task ${i + 1}`,
        createdAt: new Date(base + i * 1000),
      })),
    });

    const res = await api(userA).list("?page=3&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
    // Newest first: page 3 holds the 5 oldest tasks.
    expect(res.body.data.items.map((t: { title: string }) => t.title)).toEqual([
      "Task 5",
      "Task 4",
      "Task 3",
      "Task 2",
      "Task 1",
    ]);
  });

  it("returns an empty page past the end", async () => {
    await createTask(userA, "Only one");

    const res = await api(userA).list("?page=5");
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination.total).toBe(1);
  });

  it.each([
    ["an unknown status", "?status=DONE"],
    ["a lowercase status", "?status=pending"],
    ["page 0", "?page=0"],
    ["a non-numeric page", "?page=abc"],
    ["a limit above 100", "?limit=101"],
    ["a fractional limit", "?limit=2.5"],
  ])("rejects %s with 422", async (_case, query) => {
    const res = await api(userA).list(query);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /tasks/:id", () => {
  it("returns the caller's own task", async () => {
    const id = await createTask(userA, "Task A");

    const res = await api(userA).get(id);
    expect(res.status).toBe(200);
    expect(res.body.data.task).toMatchObject({ id, title: "Task A" });
    expect(res.body.data.task).not.toHaveProperty("userId");
  });

  it.each([
    ["a nonexistent id", NONEXISTENT_ID],
    ["a malformed id", "not-a-uuid"],
  ])("returns 404 for %s", async (_case, id) => {
    const res = await api(userA).get(id);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });
});

describe("PATCH /tasks/:id", () => {
  it("updates only the supplied fields", async () => {
    const id = await createTask(userA, "Original");

    const res = await api(userA).update(id, { title: "Renamed", status: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.data.task).toMatchObject({
      title: "Renamed",
      status: "IN_PROGRESS",
      description: "Original description",
    });
  });

  it("clears the description when sent null", async () => {
    const id = await createTask(userA, "Has details");

    const res = await api(userA).update(id, { description: null });
    expect(res.body.data.task.description).toBeNull();
  });

  it("rejects an empty update", async () => {
    const id = await createTask(userA, "Unchanged");

    const res = await api(userA).update(id, {});
    expect(res.status).toBe(422);
    expect(res.body.error.details.root).toEqual(["Provide at least one field to update"]);
  });

  it.each(["pending", "done", "finished", "complete", "working"])(
    "rejects the non-canonical status %j",
    async (status) => {
      const id = await createTask(userA, "Strict status");

      const res = await api(userA).update(id, { status });
      expect(res.status).toBe(422);
      expect(res.body.error.details.status).toBeDefined();
    },
  );

  it("rejects attempts to reassign ownership or timestamps", async () => {
    const id = await createTask(userA, "Mine");

    const res = await api(userA).update(id, { userId: userB.id, createdAt: "2000-01-01" });

    expect(res.status).toBe(422);
    const row = await prisma.task.findUniqueOrThrow({ where: { id } });
    expect(row.userId).toBe(userA.id);
  });

  describe("status transitions", () => {
    it("allows PENDING → IN_PROGRESS → COMPLETED → IN_PROGRESS", async () => {
      const id = await createTask(userA, "Lifecycle");

      for (const status of ["IN_PROGRESS", "COMPLETED", "IN_PROGRESS"]) {
        const res = await api(userA).update(id, { status });
        expect(res.status).toBe(200);
        expect(res.body.data.task.status).toBe(status);
      }
    });

    it("allows completing a PENDING task directly", async () => {
      const id = await createTask(userA, "Quick win");

      expect((await api(userA).update(id, { status: "COMPLETED" })).status).toBe(200);
    });

    it("records completedAt on completion and clears it on reopen", async () => {
      const id = await createTask(userA, "Timestamped");

      const done = await api(userA).update(id, { status: "COMPLETED" });
      expect(Date.now() - new Date(done.body.data.task.completedAt).getTime()).toBeLessThan(5000);

      const reopened = await api(userA).update(id, { status: "IN_PROGRESS" });
      expect(reopened.body.data.task.completedAt).toBeNull();
    });

    it("ignores a client-supplied completedAt", async () => {
      const id = await createTask(userA, "No backdating");

      const res = await api(userA).update(id, { completedAt: "2000-01-01T00:00:00Z" });
      expect(res.status).toBe(422);
    });

    it("rejects COMPLETED → PENDING with 409", async () => {
      const id = await createTask(userA, "Done deal");
      await api(userA).update(id, { status: "COMPLETED" });

      const res = await api(userA).update(id, { status: "PENDING" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });
  });
});

describe("DELETE /tasks/:id", () => {
  it("deletes the caller's task with 204 and no body", async () => {
    const id = await createTask(userA, "Disposable");

    const res = await api(userA).remove(id);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await prisma.task.findUnique({ where: { id } })).toBeNull();
  });

  it("returns 404 when deleting the same task twice", async () => {
    const id = await createTask(userA, "Once");
    await api(userA).remove(id);

    expect((await api(userA).remove(id)).status).toBe(404);
  });

  it("deletes the task's time logs with it", async () => {
    const id = await createTask(userA, "Tracked");
    await prisma.timeLog.create({
      data: {
        userId: userA.id,
        taskId: id,
        startedAt: new Date(Date.now() - 3_600_000),
        stoppedAt: new Date(),
        durationSeconds: 3600,
      },
    });

    await api(userA).remove(id);
    expect(await prisma.timeLog.count({ where: { taskId: id } })).toBe(0);
  });
});

describe("cross-user isolation (User A vs User B's task)", () => {
  let taskB: string;
  const originalB = { title: "B's private plan", description: "B's private plan description" };

  beforeEach(async () => {
    taskB = await createTask(userB, originalB.title);
  });

  async function expectTaskBUnchanged() {
    const row = await prisma.task.findUniqueOrThrow({ where: { id: taskB } });
    expect(row).toMatchObject({ ...originalB, status: "PENDING", userId: userB.id });
  }

  it("User A can still read, update, and delete their own task", async () => {
    const taskA = await createTask(userA, "A's task");

    expect((await api(userA).get(taskA)).status).toBe(200);
    expect((await api(userA).update(taskA, { title: "A's task, edited" })).status).toBe(200);
    expect((await api(userA).remove(taskA)).status).toBe(204);
  });

  it("cannot read it — 404, identical to a task that does not exist", async () => {
    const res = await api(userA).get(taskB);
    const missing = await api(userA).get(NONEXISTENT_ID);

    expect(res.status).toBe(404);
    expect(withoutRequestId(res.body)).toEqual(withoutRequestId(missing.body));
    expect(JSON.stringify(res.body)).not.toContain(originalB.title);
  });

  it("cannot update it (ID manipulation) — 404 and the task is unchanged", async () => {
    const res = await api(userA).update(taskB, { title: "Hacked task", status: "COMPLETED" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
    await expectTaskBUnchanged();
  });

  it("cannot delete it — 404 and the task still exists", async () => {
    const res = await api(userA).remove(taskB);

    expect(res.status).toBe(404);
    await expectTaskBUnchanged();
  });

  it("never sees it in listings, filtered or not", async () => {
    for (const query of ["", "?status=PENDING", "?limit=100"]) {
      const res = await api(userA).list(query);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    }
  });

  it("User B keeps full access to their own task", async () => {
    const res = await api(userB).get(taskB);

    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe(originalB.title);
  });
});
