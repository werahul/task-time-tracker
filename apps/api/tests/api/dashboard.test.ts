import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { buildInsights } from "../../src/modules/dashboard/dashboard.service";
import { createAuthedUser, resetDatabase, type AuthedUser } from "../helpers";
import {
  HOUR,
  V1,
  at,
  newTask as createTask,
  seedLog,
  setNow,
  setStatus as updateStatus,
} from "./dashboard.helpers";

const app = createApp();

function summary(user: AuthedUser, query: Record<string, string> = {}) {
  const qs = new URLSearchParams({ timezone: "UTC", ...query }).toString();
  return request(app).get(`${V1}/dashboard/daily-summary?${qs}`).set("Cookie", user.cookie);
}

const newTask = (user: AuthedUser, title: string) => createTask(app, user, title);
const setStatus = (user: AuthedUser, taskId: string, status: string) =>
  updateStatus(app, user, taskId, status);

let userA: AuthedUser;
let userB: AuthedUser;

beforeEach(async () => {
  await resetDatabase();
  userA = await createAuthedUser(app, "dash.a@example.com");
  userB = await createAuthedUser(app, "dash.b@example.com");
});
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe("authentication", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(`${V1}/dashboard/daily-summary`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("daily totals", () => {
  beforeEach(() => setNow("2026-09-10T15:00:00Z"));

  it("returns an empty summary for a day with no activity", async () => {
    const res = await summary(userA);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      date: "2026-09-10",
      timezone: "UTC",
      range: { start: "2026-09-10T00:00:00.000Z", end: "2026-09-11T00:00:00.000Z" },
      isToday: true,
      totalTrackedSeconds: 0,
      totalTrackedFormatted: "0s",
      tasksWorkedOn: 0,
      completedTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      activeTimer: null,
      topTasks: [],
      insights: ["No time tracked yet today."],
    });
  });

  it("counts a single completed log", async () => {
    const task = await newTask(userA, "Write report");
    await seedLog(userA, task, "2026-09-10T09:00:00Z", "2026-09-10T10:00:00Z");

    const { body } = await summary(userA);

    expect(body.data).toMatchObject({
      totalTrackedSeconds: HOUR,
      totalTrackedFormatted: "1h 00m",
      tasksWorkedOn: 1,
      topTasks: [{ taskId: task, title: "Write report", trackedSeconds: HOUR }],
    });
  });

  it("sums multiple logs and counts a task with several logs once", async () => {
    const a = await newTask(userA, "Task A");
    const b = await newTask(userA, "Task B");
    await newTask(userA, "Task C (no time today)");
    await seedLog(userA, a, "2026-09-10T08:00:00Z", "2026-09-10T08:30:00Z");
    await seedLog(userA, a, "2026-09-10T09:00:00Z", "2026-09-10T09:20:00Z");
    await seedLog(userA, a, "2026-09-10T11:00:00Z", "2026-09-10T11:05:00Z");
    await seedLog(userA, b, "2026-09-10T12:00:00Z", "2026-09-10T12:10:00Z");

    const { body } = await summary(userA);

    expect(body.data.totalTrackedSeconds).toBe(55 * 60 + 10 * 60);
    expect(body.data.tasksWorkedOn).toBe(2);
    expect(body.data.topTasks).toEqual([
      { taskId: a, title: "Task A", trackedSeconds: 55 * 60 },
      { taskId: b, title: "Task B", trackedSeconds: 10 * 60 },
    ]);
  });

  it("includes the running timer's elapsed time, computed from server time", async () => {
    const task = await newTask(userA, "Deep work");
    setNow("2026-09-10T14:00:00Z");
    await request(app).post(`${V1}/tasks/${task}/timer/start`).set("Cookie", userA.cookie);
    setNow("2026-09-10T14:10:00Z");

    const { body } = await summary(userA);

    expect(body.data.totalTrackedSeconds).toBe(600);
    expect(body.data.tasksWorkedOn).toBe(1);
    expect(body.data.activeTimer).toEqual({
      taskId: task,
      title: "Deep work",
      startedAt: "2026-09-10T14:00:00.000Z",
      elapsedSeconds: 600,
    });
    expect(body.data.topTasks).toEqual([{ taskId: task, title: "Deep work", trackedSeconds: 600 }]);
  });

  it("combines completed logs with the running timer", async () => {
    const task = await newTask(userA, "Mixed");
    await seedLog(userA, task, "2026-09-10T09:00:00Z", "2026-09-10T10:00:00Z");
    await seedLog(userA, task, "2026-09-10T14:50:00Z", null); // running for 10 min

    const { body } = await summary(userA);

    expect(body.data.totalTrackedSeconds).toBe(HOUR + 600);
    expect(body.data.tasksWorkedOn).toBe(1);
  });

  it("orders top tasks by tracked time and returns at most 5", async () => {
    for (let i = 1; i <= 6; i++) {
      const task = await newTask(userA, `Task ${i}`);
      const start = at("2026-09-10T00:00:00Z").getTime() + i * HOUR * 1000;
      await seedLog(
        userA,
        task,
        new Date(start).toISOString(),
        new Date(start + i * 60 * 1000).toISOString(), // Task i gets i minutes
      );
    }

    const { body } = await summary(userA);

    expect(body.data.tasksWorkedOn).toBe(6);
    expect(body.data.topTasks.map((t: { title: string }) => t.title)).toEqual([
      "Task 6",
      "Task 5",
      "Task 4",
      "Task 3",
      "Task 2",
    ]);
  });
});

describe("date handling", () => {
  beforeEach(() => setNow("2026-09-10T15:00:00Z"));

  it("summarizes a previous day on request, and only that day", async () => {
    const task = await newTask(userA, "Yesterday's work");
    await seedLog(userA, task, "2026-09-09T09:00:00Z", "2026-09-09T11:00:00Z");

    const yesterday = await summary(userA, { date: "2026-09-09" });
    const today = await summary(userA);

    expect(yesterday.body.data).toMatchObject({
      date: "2026-09-09",
      isToday: false,
      totalTrackedSeconds: 2 * HOUR,
    });
    expect(yesterday.body.data.insights[0]).toBe("You tracked 2h 00m on this day across 1 task.");
    expect(today.body.data.totalTrackedSeconds).toBe(0);
  });

  it("rejects a future date", async () => {
    const res = await summary(userA, { date: "2026-09-11" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DATE_IN_FUTURE");
  });

  it("judges 'future' in the requested timezone", async () => {
    // 15:00 UTC is already 2026-09-11 in Pacific/Kiritimati (UTC+14).
    const res = await summary(userA, { date: "2026-09-11", timezone: "Pacific/Kiritimati" });

    expect(res.status).toBe(200);
    expect(res.body.data.isToday).toBe(true);
  });

  it("uses APP_TIMEZONE (UTC in tests) when no timezone is sent", async () => {
    const res = await request(app).get(`${V1}/dashboard/daily-summary`).set("Cookie", userA.cookie);

    expect(res.body.data).toMatchObject({ date: "2026-09-10", timezone: "UTC" });
  });

  it("assigns a log to the calendar day of the requested timezone", async () => {
    const task = await newTask(userA, "Evening in UTC, early morning in India");
    // 20:00–21:00 UTC = 01:30–02:30 next day in Asia/Kolkata (UTC+05:30).
    await seedLog(userA, task, "2026-09-09T20:00:00Z", "2026-09-09T21:00:00Z");

    const utcDay = await summary(userA, { date: "2026-09-09", timezone: "UTC" });
    const kolkataSameDay = await summary(userA, { date: "2026-09-09", timezone: "Asia/Kolkata" });
    const kolkataNextDay = await summary(userA, { date: "2026-09-10", timezone: "Asia/Kolkata" });

    expect(utcDay.body.data.totalTrackedSeconds).toBe(HOUR);
    expect(kolkataSameDay.body.data.totalTrackedSeconds).toBe(0);
    expect(kolkataNextDay.body.data.totalTrackedSeconds).toBe(HOUR);
    expect(kolkataNextDay.body.data.range).toEqual({
      start: "2026-09-09T18:30:00.000Z",
      end: "2026-09-10T18:30:00.000Z",
    });
  });

  it("splits a log crossing midnight between the two days", async () => {
    const task = await newTask(userA, "Late night");
    await seedLog(userA, task, "2026-09-08T23:30:00Z", "2026-09-09T00:30:00Z");

    const before = await summary(userA, { date: "2026-09-08" });
    const after = await summary(userA, { date: "2026-09-09" });

    expect(before.body.data).toMatchObject({ totalTrackedSeconds: 1800, tasksWorkedOn: 1 });
    expect(after.body.data).toMatchObject({ totalTrackedSeconds: 1800, tasksWorkedOn: 1 });
    expect(after.body.data.topTasks[0].trackedSeconds).toBe(1800);
  });

  it("clips a running timer that started before midnight", async () => {
    const task = await newTask(userA, "Overnight");
    await seedLog(userA, task, "2026-09-09T23:00:00Z", null);
    setNow("2026-09-10T01:00:00Z");

    const yesterday = await summary(userA, { date: "2026-09-09" });
    const today = await summary(userA, { date: "2026-09-10" });

    expect(yesterday.body.data.totalTrackedSeconds).toBe(HOUR);
    expect(today.body.data.totalTrackedSeconds).toBe(HOUR);
    expect(today.body.data.activeTimer.elapsedSeconds).toBe(2 * HOUR);
  });

  it("handles a 25-hour day at a DST change", async () => {
    setNow("2026-11-02T12:00:00Z");
    // Sign in at the pinned time; tokens issued before it would already be expired.
    const user = await createAuthedUser(app, "dst@example.com");
    const task = await newTask(user, "DST day");
    // 04:30–04:45 UTC on Nov 2 is 23:30–23:45 EST on Nov 1 in New York.
    await seedLog(user, task, "2026-11-02T04:30:00Z", "2026-11-02T04:45:00Z");

    const res = await summary(user, { date: "2026-11-01", timezone: "America/New_York" });

    expect(res.body.data.range).toEqual({
      start: "2026-11-01T04:00:00.000Z", // midnight EDT (UTC-4)
      end: "2026-11-02T05:00:00.000Z", // midnight EST (UTC-5): 25 hours later
    });
    expect(res.body.data.totalTrackedSeconds).toBe(900);
  });

  it.each([
    ["an impossible month", { date: "2026-13-01" }],
    ["an impossible day", { date: "2026-02-30" }],
    ["a non-ISO date", { date: "10-09-2026" }],
    ["a relative date", { date: "yesterday" }],
    ["an unknown timezone", { timezone: "Mars/Olympus_Mons" }],
    ["an injection attempt", { timezone: 'UTC\'; DROP TABLE "Task"; --' }],
  ])("rejects %s with 422", async (_case, query) => {
    const res = await summary(userA, query);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("task counts", () => {
  it("counts completions within the day and the current open workload", async () => {
    setNow("2026-09-09T10:00:00Z");
    const doneYesterday = await newTask(userA, "Done yesterday");
    await setStatus(userA, doneYesterday, "COMPLETED");

    setNow("2026-09-10T10:00:00Z");
    for (const title of ["Done today 1", "Done today 2"]) {
      await setStatus(userA, await newTask(userA, title), "COMPLETED");
    }
    await setStatus(userA, await newTask(userA, "Started"), "IN_PROGRESS");
    await newTask(userA, "Not started");

    const today = await summary(userA);
    const yesterday = await summary(userA, { date: "2026-09-09" });

    expect(today.body.data).toMatchObject({
      completedTasks: 2,
      pendingTasks: 1,
      inProgressTasks: 1,
    });
    expect(yesterday.body.data.completedTasks).toBe(1);
  });

  it("stops counting a completion once the task is reopened", async () => {
    setNow("2026-09-10T10:00:00Z");
    const task = await newTask(userA, "Reopened");
    await setStatus(userA, task, "COMPLETED");
    await setStatus(userA, task, "IN_PROGRESS");

    const { body } = await summary(userA);
    expect(body.data).toMatchObject({ completedTasks: 0, inProgressTasks: 1 });
  });
});

describe("isolation between users", () => {
  it("never includes another user's time, tasks, counts, or timer", async () => {
    setNow("2026-09-10T15:00:00Z");
    const own = await newTask(userA, "A's task");
    await seedLog(userA, own, "2026-09-10T09:00:00Z", "2026-09-10T09:30:00Z");

    const foreign = await newTask(userB, "B's secret task");
    await seedLog(userB, foreign, "2026-09-10T10:00:00Z", "2026-09-10T13:00:00Z");
    await seedLog(userB, foreign, "2026-09-10T14:00:00Z", null);
    await setStatus(userB, await newTask(userB, "B done"), "COMPLETED");
    await newTask(userB, "B pending");

    const a = await summary(userA);
    const b = await summary(userB);

    expect(a.body.data).toMatchObject({
      totalTrackedSeconds: 1800,
      tasksWorkedOn: 1,
      completedTasks: 0,
      pendingTasks: 1,
      inProgressTasks: 0,
      activeTimer: null,
    });
    expect(JSON.stringify(a.body)).not.toContain("B's secret task");
    expect(b.body.data.totalTrackedSeconds).toBe(3 * HOUR + HOUR);
    expect(b.body.data.completedTasks).toBe(1);
  });
});

describe("insights", () => {
  const base = {
    date: "2026-09-10",
    timezone: "UTC",
    range: { start: new Date(), end: new Date() },
    isToday: true,
    totalTrackedSeconds: 0,
    totalTrackedFormatted: "0s",
    tasksWorkedOn: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    activeTimer: null,
    topTasks: [],
  };

  it("describes a productive day from the real numbers", () => {
    expect(
      buildInsights({
        ...base,
        totalTrackedSeconds: 10_020,
        tasksWorkedOn: 3,
        completedTasks: 2,
        topTasks: [{ taskId: "t", title: "Authentication API", trackedSeconds: 5400 }],
      }),
    ).toEqual([
      "You tracked 2h 47m today across 3 tasks.",
      "You completed 2 tasks.",
      "Your most time-intensive task was “Authentication API” (1h 30m).",
    ]);
  });

  it("uses singular wording for a single task", () => {
    expect(
      buildInsights({
        ...base,
        totalTrackedSeconds: 600,
        tasksWorkedOn: 1,
        completedTasks: 1,
        topTasks: [{ taskId: "t", title: "Only task", trackedSeconds: 600 }],
      }),
    ).toEqual([
      "You tracked 10m today across 1 task.",
      "You completed 1 task.",
      "All of it went to “Only task”.",
    ]);
  });

  it("says so when nothing was tracked", () => {
    expect(buildInsights(base)).toEqual(["No time tracked yet today."]);
    expect(buildInsights({ ...base, isToday: false })).toEqual([
      "No time was tracked on this day.",
    ]);
  });
});
