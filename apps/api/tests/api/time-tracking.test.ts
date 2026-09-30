import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { timeTrackingRepository } from "../../src/modules/time-tracking/time-tracking.repository";
import { calculateDurationSeconds } from "../../src/modules/time-tracking/time-tracking.service";
import { withoutRequestId, createAuthedUser, resetDatabase, type AuthedUser } from "../helpers";

const app = createApp();
const V1 = "/api/v1";
const NONEXISTENT_ID = "00000000-0000-4000-8000-000000000000";

const as = (user: AuthedUser) => ({
  createTask: (title: string) =>
    request(app).post(`${V1}/tasks`).set("Cookie", user.cookie).send({ title }),
  getTask: (taskId: string) => request(app).get(`${V1}/tasks/${taskId}`).set("Cookie", user.cookie),
  updateTask: (taskId: string, body: object) =>
    request(app).patch(`${V1}/tasks/${taskId}`).set("Cookie", user.cookie).send(body),
  deleteTask: (taskId: string) =>
    request(app).delete(`${V1}/tasks/${taskId}`).set("Cookie", user.cookie),
  start: (taskId: string, body?: object) => {
    const req = request(app).post(`${V1}/tasks/${taskId}/timer/start`).set("Cookie", user.cookie);
    return body ? req.send(body) : req;
  },
  stop: (taskId: string) =>
    request(app).post(`${V1}/tasks/${taskId}/timer/stop`).set("Cookie", user.cookie),
  active: () => request(app).get(`${V1}/time-logs/active`).set("Cookie", user.cookie),
  logs: (query = "") => request(app).get(`${V1}/time-logs${query}`).set("Cookie", user.cookie),
  taskLogs: (taskId: string, query = "") =>
    request(app).get(`${V1}/tasks/${taskId}/time-logs${query}`).set("Cookie", user.cookie),
});

async function newTask(user: AuthedUser, title: string): Promise<string> {
  const res = await as(user).createTask(title);
  expect(res.status).toBe(201);
  return res.body.data.task.id as string;
}

/** Simulates elapsed time by moving a running timer's server-set startedAt into the past. */
async function backdateRunningTimer(userId: string, seconds: number, extraMs = 0) {
  const log = await prisma.timeLog.findFirstOrThrow({ where: { userId, stoppedAt: null } });
  await prisma.timeLog.update({
    where: { id: log.id },
    data: { startedAt: new Date(log.startedAt.getTime() - seconds * 1000 - extraMs) },
  });
}

/** Records a finished session directly, as if timed earlier. */
async function seedCompletedLog(
  user: AuthedUser,
  taskId: string,
  startedAt: Date,
  seconds: number,
) {
  await prisma.timeLog.create({
    data: {
      userId: user.id,
      taskId,
      startedAt,
      stoppedAt: new Date(startedAt.getTime() + seconds * 1000),
      durationSeconds: seconds,
    },
  });
}

const activeCount = (userId: string) =>
  prisma.timeLog.count({ where: { userId, stoppedAt: null } });

let userA: AuthedUser;
let userB: AuthedUser;
let taskA: string;
let taskB: string;

beforeEach(async () => {
  await resetDatabase();
  userA = await createAuthedUser(app, "timer.a@example.com");
  userB = await createAuthedUser(app, "timer.b@example.com");
  taskA = await newTask(userA, "Build authentication API");
  taskB = await newTask(userB, "B's secret task");
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

describe("authentication requirement", () => {
  it.each([
    ["POST", `/tasks/${NONEXISTENT_ID}/timer/start`],
    ["POST", `/tasks/${NONEXISTENT_ID}/timer/stop`],
    ["GET", `/tasks/${NONEXISTENT_ID}/time-logs`],
    ["GET", "/time-logs/active"],
    ["GET", "/time-logs"],
  ])("%s %s returns 401 without an access token", async (method, path) => {
    const res = await request(app)[method.toLowerCase() as "get"](`${V1}${path}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("POST /tasks/:taskId/timer/start", () => {
  it("starts a server-timed session on the user's own task", async () => {
    const before = Date.now();
    const res = await as(userA).start(taskA);
    const after = Date.now();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      taskId: taskA,
      task: { id: taskA, title: "Build authentication API" },
      stoppedAt: null,
      durationSeconds: 0,
      elapsedSeconds: 0,
      elapsedMs: 0,
    });
    const startedAt = new Date(res.body.data.startedAt).getTime();
    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(startedAt).toBeLessThanOrEqual(after);
  });

  it("moves a PENDING task to IN_PROGRESS", async () => {
    await as(userA).start(taskA);

    const task = await as(userA).getTask(taskA);
    expect(task.body.data.task.status).toBe("IN_PROGRESS");
  });

  it("rejects client-supplied timestamps, duration, or owner and creates nothing", async () => {
    const res = await as(userA).start(taskA, {
      startedAt: "2000-01-01T00:00:00Z",
      durationSeconds: 99_999,
      userId: userB.id,
    });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(["startedAt", "durationSeconds", "userId"]),
    );
    expect(await prisma.timeLog.count()).toBe(0);
  });

  it("rejects a second start on the same task (double click)", async () => {
    await as(userA).start(taskA);
    const res = await as(userA).start(taskA);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACTIVE_TIMER_EXISTS");
    expect(await activeCount(userA.id)).toBe(1);
  });

  it("rejects starting another task while a timer is running", async () => {
    const otherTask = await newTask(userA, "Other work");
    await as(userA).start(taskA);

    const res = await as(userA).start(otherTask);
    expect(res.status).toBe(409);
    expect(withoutRequestId(res.body).error).toEqual({
      code: "ACTIVE_TIMER_EXISTS",
      message: "Another timer is already running.",
    });
  });

  it("rejects timing a COMPLETED task", async () => {
    await as(userA).updateTask(taskA, { status: "COMPLETED" });

    const res = await as(userA).start(taskA);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TIMER_STATE");
  });

  it("completing a task stops its running timer at the completion instant", async () => {
    await as(userA).start(taskA);
    await backdateRunningTimer(userA.id, 600, 250);

    const done = await as(userA).updateTask(taskA, { status: "COMPLETED" });

    expect(done.status).toBe(200);
    expect((await as(userA).active()).body.data).toBeNull();
    const [log] = await prisma.timeLog.findMany({ where: { userId: userA.id } });
    expect(log.stoppedAt?.toISOString()).toBe(done.body.data.task.completedAt);
    expect(log.durationSeconds).toBe(600); // floored, like a normal stop
    // A new timer can start right away on another task.
    expect((await as(userA).start(await newTask(userA, "Next"))).status).toBe(201);
  });

  it("completing a task leaves a timer running on a different task alone", async () => {
    const other = await newTask(userA, "Other");
    await as(userA).start(other);

    await as(userA).updateTask(taskA, { status: "COMPLETED" });

    expect((await as(userA).active()).body.data.taskId).toBe(other);
  });

  it("returns 404 for another user's task and changes nothing", async () => {
    const res = await as(userA).start(taskB);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
    expect(await prisma.timeLog.count()).toBe(0);
    const taskBRow = await prisma.task.findUniqueOrThrow({ where: { id: taskB } });
    expect(taskBRow.status).toBe("PENDING");
  });

  it.each([
    ["a nonexistent task", NONEXISTENT_ID],
    ["a malformed id", "not-a-uuid"],
  ])("returns 404 for %s", async (_case, taskId) => {
    const res = await as(userA).start(taskId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("lets only one of many simultaneous starts succeed (same task)", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => as(userA).start(taskA)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    results
      .filter((r) => r.status === 409)
      .forEach((r) => expect(r.body.error.code).toBe("ACTIVE_TIMER_EXISTS"));
    expect(await activeCount(userA.id)).toBe(1);
  });

  it("maps a lost race at the database (unique index) to 409, not a raw error", async () => {
    // Deterministically reproduce the race window: another request inserts its
    // timer after our friendly pre-check ran but before our insert.
    await as(userA).start(taskA);
    const otherTask = await newTask(userA, "Racing task");
    const preCheck = vi
      .spyOn(timeTrackingRepository, "findActiveTimerByUser")
      .mockResolvedValueOnce(null);

    const res = await as(userA).start(otherTask);

    expect(preCheck).toHaveBeenCalled();
    expect(res.status).toBe(409);
    expect(withoutRequestId(res.body).error).toEqual({
      code: "ACTIVE_TIMER_EXISTS",
      message: "Another timer is already running.",
    });
    expect(await activeCount(userA.id)).toBe(1);
    // The transaction rolled back: the losing task was not moved to IN_PROGRESS.
    const loser = await prisma.task.findUniqueOrThrow({ where: { id: otherTask } });
    expect(loser.status).toBe("PENDING");
  });

  it("lets only one of many simultaneous starts succeed (different tasks)", async () => {
    const tasks = [taskA, ...(await Promise.all([1, 2, 3].map((n) => newTask(userA, `T${n}`))))];

    const results = await Promise.all(tasks.map((taskId) => as(userA).start(taskId)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await activeCount(userA.id)).toBe(1);
  });
});

describe("POST /tasks/:taskId/timer/stop", () => {
  it("stops the timer with a server-calculated, floored duration", async () => {
    await as(userA).start(taskA);
    await backdateRunningTimer(userA.id, 90, 500); // 90.5s ago

    const res = await as(userA).stop(taskA);

    expect(res.status).toBe(200);
    expect(res.body.data.durationSeconds).toBe(90);
    const { startedAt, stoppedAt } = res.body.data;
    expect(new Date(stoppedAt).getTime() - new Date(startedAt).getTime()).toBeGreaterThanOrEqual(
      90_500,
    );
  });

  it("calculates a long-running (30-hour) session on the server", async () => {
    await as(userA).start(taskA);
    await backdateRunningTimer(userA.id, 30 * 3600);

    const res = await as(userA).stop(taskA);

    expect(res.status).toBe(200);
    expect(res.body.data.durationSeconds).toBe(30 * 3600);
  });

  it("does not mark the task COMPLETED", async () => {
    await as(userA).start(taskA);
    await as(userA).stop(taskA);

    const task = await as(userA).getTask(taskA);
    expect(task.body.data.task.status).toBe("IN_PROGRESS");
  });

  it("rejects stopping an already-stopped timer and leaves the log unchanged", async () => {
    await as(userA).start(taskA);
    const first = await as(userA).stop(taskA);

    const second = await as(userA).stop(taskA);

    expect(second.status).toBe(404);
    expect(second.body.error.code).toBe("ACTIVE_TIMER_NOT_FOUND");
    const logs = await prisma.timeLog.findMany({ where: { userId: userA.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].stoppedAt?.toISOString()).toBe(first.body.data.stoppedAt);
  });

  it("lets only one of two simultaneous stops succeed", async () => {
    await as(userA).start(taskA);

    const results = await Promise.all([as(userA).stop(taskA), as(userA).stop(taskA)]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses[0]).toBe(200);
    expect([404, 409]).toContain(statuses[1]);
    expect(await prisma.timeLog.count({ where: { userId: userA.id } })).toBe(1);
  });

  it("returns 404 ACTIVE_TIMER_NOT_FOUND when nothing is running on the task", async () => {
    const res = await as(userA).stop(taskA);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ACTIVE_TIMER_NOT_FOUND");
  });

  it("does not stop a timer running on a different task", async () => {
    const otherTask = await newTask(userA, "Other work");
    await as(userA).start(otherTask);

    const res = await as(userA).stop(taskA);
    expect(res.status).toBe(404);
    expect(await activeCount(userA.id)).toBe(1);
  });

  it("cannot stop another user's timer — 404 and B's timer keeps running", async () => {
    await as(userB).start(taskB);

    const res = await as(userA).stop(taskB);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
    expect(await activeCount(userB.id)).toBe(1);
  });

  it("allows a new session after stopping", async () => {
    await as(userA).start(taskA);
    await as(userA).stop(taskA);

    expect((await as(userA).start(taskA)).status).toBe(201);
  });
});

describe("GET /time-logs/active", () => {
  it("returns null when no timer is running", async () => {
    const res = await as(userA).active();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });

  it("restores the running timer with server-computed elapsed time (refresh)", async () => {
    const started = await as(userA).start(taskA);
    await backdateRunningTimer(userA.id, 3600);

    const res = await as(userA).active();

    expect(res.body.data).toMatchObject({
      id: started.body.data.id,
      task: { id: taskA, title: "Build authentication API" },
      stoppedAt: null,
    });
    expect(res.body.data.elapsedSeconds).toBeGreaterThanOrEqual(3600);
    expect(res.body.data.elapsedSeconds).toBeLessThan(3610);
    // Millisecond precision, consistent with the whole seconds.
    expect(Math.floor(res.body.data.elapsedMs / 1000)).toBe(res.body.data.elapsedSeconds);
  });

  it("reports elapsedMs with the sub-second fraction, so a reload never loses it", async () => {
    await as(userA).start(taskA);
    await backdateRunningTimer(userA.id, 5, 900); // 5.9 s ago

    const { body } = await as(userA).active();

    expect(body.data.elapsedSeconds).toBe(5);
    expect(body.data.elapsedMs).toBeGreaterThanOrEqual(5900);
  });

  it("returns null again after the timer stops", async () => {
    await as(userA).start(taskA);
    await as(userA).stop(taskA);

    expect((await as(userA).active()).body.data).toBeNull();
  });

  it("never shows another user's running timer", async () => {
    await as(userB).start(taskB);

    expect((await as(userA).active()).body.data).toBeNull();
  });
});

describe("GET /time-logs", () => {
  it("lists only the user's logs, newest first, with pagination", async () => {
    const day = 24 * 3600 * 1000;
    await seedCompletedLog(userA, taskA, new Date(Date.now() - 3 * day), 600);
    await seedCompletedLog(userA, taskA, new Date(Date.now() - 1 * day), 1200);
    await seedCompletedLog(userB, taskB, new Date(Date.now() - 2 * day), 999);

    const res = await as(userA).logs("?limit=1");

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].durationSeconds).toBe(1200);
  });

  it("filters by date range on startedAt ([from, to))", async () => {
    const base = new Date("2026-09-01T00:00:00.000Z");
    const hour = 3600 * 1000;
    await seedCompletedLog(userA, taskA, new Date(base.getTime() - hour), 60); // day before
    await seedCompletedLog(userA, taskA, new Date(base.getTime() + hour), 120); // in range
    await seedCompletedLog(userA, taskA, new Date(base.getTime() + 25 * hour), 180); // next day

    const res = await as(userA).logs("?from=2026-09-01T00:00:00.000Z&to=2026-09-02T00:00:00.000Z");

    expect(res.body.data.items.map((l: { durationSeconds: number }) => l.durationSeconds)).toEqual([
      120,
    ]);
  });

  it("filters by task, and another user's task id yields nothing", async () => {
    const otherTask = await newTask(userA, "Other");
    await seedCompletedLog(userA, taskA, new Date(Date.now() - 7200_000), 60);
    await seedCompletedLog(userA, otherTask, new Date(Date.now() - 3600_000), 60);
    await seedCompletedLog(userB, taskB, new Date(Date.now() - 3600_000), 60);

    const own = await as(userA).logs(`?taskId=${taskA}`);
    const foreign = await as(userA).logs(`?taskId=${taskB}`);

    expect(own.body.data.items.map((l: { taskId: string }) => l.taskId)).toEqual([taskA]);
    expect(foreign.body.data.items).toEqual([]);
    expect(foreign.body.data.pagination.total).toBe(0);
  });

  it.each([
    ["a non-ISO from", "?from=yesterday"],
    ["a date without timezone", "?from=2026-09-01"],
    ["from after to", "?from=2026-09-02T00:00:00Z&to=2026-09-01T00:00:00Z"],
    ["a malformed taskId", "?taskId=abc"],
    ["a limit above 100", "?limit=500"],
  ])("rejects %s with 422", async (_case, query) => {
    const res = await as(userA).logs(query);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /tasks/:taskId/time-logs", () => {
  it("returns the task's logs and a SUM of completed durations", async () => {
    await seedCompletedLog(userA, taskA, new Date(Date.now() - 7200_000), 1500);
    await seedCompletedLog(userA, taskA, new Date(Date.now() - 5400_000), 900);
    await as(userA).start(taskA); // running timer contributes nothing to the total

    const res = await as(userA).taskLogs(taskA);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSeconds).toBe(2400);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.items[0].stoppedAt).toBeNull(); // newest (running) first
  });

  it("returns a zero total for a task with no time", async () => {
    const res = await as(userA).taskLogs(taskA);

    expect(res.body.data).toMatchObject({ items: [], totalSeconds: 0 });
  });

  it("returns 404 for another user's task (logs and totals stay private)", async () => {
    await seedCompletedLog(userB, taskB, new Date(Date.now() - 3600_000), 1800);

    const res = await as(userA).taskLogs(taskB);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
    expect(JSON.stringify(res.body)).not.toContain("1800");
  });
});

describe("data integrity", () => {
  it("cascades a task's time logs (including a running timer) on delete", async () => {
    await seedCompletedLog(userA, taskA, new Date(Date.now() - 7200_000), 60);
    await as(userA).start(taskA);

    expect((await as(userA).deleteTask(taskA)).status).toBe(204);
    expect(await prisma.timeLog.count({ where: { taskId: taskA } })).toBe(0);
    expect((await as(userA).active()).body.data).toBeNull();
  });

  it("keeps every recorded duration non-negative", async () => {
    await as(userA).start(taskA);
    await as(userA).stop(taskA);
    await as(userA).start(taskA);

    const negative = await prisma.timeLog.count({ where: { durationSeconds: { lt: 0 } } });
    expect(negative).toBe(0);
  });

  describe("database constraints (last line of defense)", () => {
    const base = () => ({ userId: userA.id, taskId: taskA, startedAt: new Date() });

    it("rejects a second active timer inserted directly", async () => {
      await prisma.timeLog.create({ data: base() });
      await expect(prisma.timeLog.create({ data: base() })).rejects.toThrow();
    });

    it("rejects a negative duration", async () => {
      const startedAt = new Date(Date.now() - 1000);
      await expect(
        prisma.timeLog.create({
          data: { ...base(), startedAt, stoppedAt: new Date(), durationSeconds: -5 },
        }),
      ).rejects.toThrow(/TimeLog_duration_non_negative|check constraint/i);
    });

    it("rejects stoppedAt before startedAt", async () => {
      await expect(
        prisma.timeLog.create({
          data: { ...base(), stoppedAt: new Date(Date.now() - 60_000), durationSeconds: 0 },
        }),
      ).rejects.toThrow();
    });

    it("rejects a duration that disagrees with the timestamps", async () => {
      const startedAt = new Date(Date.now() - 60_000);
      await expect(
        prisma.timeLog.create({
          data: { ...base(), startedAt, stoppedAt: new Date(), durationSeconds: 99_999 },
        }),
      ).rejects.toThrow();
    });

    it("rejects a time log whose user does not own the task", async () => {
      await expect(
        prisma.timeLog.create({ data: { userId: userA.id, taskId: taskB, startedAt: new Date() } }),
      ).rejects.toThrow();
    });
  });
});

describe("calculateDurationSeconds", () => {
  const start = new Date("2026-09-29T10:00:00.000Z");

  it.each([
    [0, 0],
    [999, 0],
    [45_000, 45],
    [5_100_999, 5100], // 10:00 → 11:25 (+999ms) = 5100s
  ])("%ims → %is (floored)", (ms, seconds) => {
    expect(calculateDurationSeconds(start, new Date(start.getTime() + ms))).toBe(seconds);
  });

  it("never returns a negative duration", () => {
    expect(calculateDurationSeconds(start, new Date(start.getTime() - 5000))).toBe(0);
  });
});
