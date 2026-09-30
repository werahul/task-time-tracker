import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { createAuthedUser, resetDatabase, type AuthedUser } from "../helpers";
import {
  HOUR,
  V1,
  newTask as createTask,
  seedLog,
  setNow,
  setStatus as updateStatus,
} from "./dashboard.helpers";

const app = createApp();

// "Now" for most tests: Wednesday 2026-09-09, in the week Mon 09-07 → Sun 09-13.
// It must not be later than the real clock: test users' tokens are signed at
// real time and would already be expired at a later pinned time.
const WEDNESDAY_AFTERNOON = "2026-09-09T15:00:00Z";
const THIS_WEEK = [
  "2026-09-07",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
  "2026-09-12",
  "2026-09-13",
];

interface Day {
  date: string;
  trackedSeconds: number;
  tasksWorkedOn: number;
  completedTasks: number;
  isFuture: boolean;
}

function weekly(user: AuthedUser, query: Record<string, string> = {}) {
  const qs = new URLSearchParams({ timezone: "UTC", ...query }).toString();
  return request(app).get(`${V1}/dashboard/weekly-summary?${qs}`).set("Cookie", user.cookie);
}

/** Daily breakdown as { date: trackedSeconds } for compact assertions. */
const secondsByDay = (days: Day[]) =>
  Object.fromEntries(days.map((day) => [day.date, day.trackedSeconds]));

const newTask = (user: AuthedUser, title: string) => createTask(app, user, title);
const setStatus = (user: AuthedUser, taskId: string, status: string) =>
  updateStatus(app, user, taskId, status);

let userA: AuthedUser;
let userB: AuthedUser;

beforeEach(async () => {
  await resetDatabase();
  userA = await createAuthedUser(app, "week.a@example.com");
  userB = await createAuthedUser(app, "week.b@example.com");
});
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe("authentication", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(`${V1}/dashboard/weekly-summary`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("week range", () => {
  beforeEach(() => setNow(WEDNESDAY_AFTERNOON));

  it("defaults to the current Monday → Sunday week, with an entry for every day", async () => {
    const res = await weekly(userA);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      timezone: "UTC",
      range: { start: "2026-09-07T00:00:00.000Z", end: "2026-09-14T00:00:00.000Z" },
      isCurrentWeek: true,
      elapsedDays: 3,
      totalTrackedSeconds: 0,
      totalTrackedFormatted: "0s",
      averageDailySeconds: 0,
      averageDailyFormatted: "0s",
      tasksWorkedOn: 0,
      completedTasks: 0,
      dailyBreakdown: THIS_WEEK.map((date, i) => ({
        date,
        trackedSeconds: 0,
        tasksWorkedOn: 0,
        completedTasks: 0,
        isFuture: i > 2, // Thursday onwards hasn't started
      })),
      topTasks: [],
    });
  });

  it.each([
    ["Monday", "2026-09-07"],
    ["Wednesday", "2026-09-09"],
    ["Sunday", "2026-09-13"],
  ])("normalizes a %s startDate to that week's Monday", async (_day, startDate) => {
    const { body } = await weekly(userA, { startDate });

    expect(body.data).toMatchObject({ startDate: "2026-09-07", endDate: "2026-09-13" });
  });

  it("returns a previous week as fully elapsed", async () => {
    const { body } = await weekly(userA, { startDate: "2026-08-31" });

    expect(body.data).toMatchObject({
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      isCurrentWeek: false,
      elapsedDays: 7,
    });
    expect(body.data.dailyBreakdown.every((day: Day) => !day.isFuture)).toBe(true);
  });

  it("rejects a future week", async () => {
    const res = await weekly(userA, { startDate: "2026-09-14" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DATE_IN_FUTURE");
  });

  it("judges the week in the requested timezone", async () => {
    // 2026-09-13 23:30 UTC is already Monday 2026-09-14 in Asia/Kolkata (UTC+05:30).
    setNow("2026-09-13T23:30:00Z");

    const utc = await weekly(userA);
    const kolkata = await weekly(userA, { timezone: "Asia/Kolkata" });

    expect(utc.body.data.startDate).toBe("2026-09-07");
    expect(kolkata.body.data).toMatchObject({
      startDate: "2026-09-14",
      elapsedDays: 1,
      range: { start: "2026-09-13T18:30:00.000Z", end: "2026-09-20T18:30:00.000Z" },
    });
  });

  it("uses APP_TIMEZONE (UTC in tests) when no timezone is sent", async () => {
    const res = await request(app)
      .get(`${V1}/dashboard/weekly-summary`)
      .set("Cookie", userA.cookie);

    expect(res.body.data).toMatchObject({ startDate: "2026-09-07", timezone: "UTC" });
  });

  it("handles a week containing a DST change (169 hours)", async () => {
    setNow("2026-11-04T12:00:00Z");
    // Sign in at the pinned time; tokens issued before it would already be expired.
    const user = await createAuthedUser(app, "dst.week@example.com");
    const task = await newTask(user, "DST week");
    // 04:30–05:30 UTC on Nov 2 is 23:30 EST Sunday Nov 1 → 00:30 Monday Nov 2 in New York.
    await seedLog(user, task, "2026-11-02T04:30:00Z", "2026-11-02T05:30:00Z");

    const res = await weekly(user, { startDate: "2026-10-26", timezone: "America/New_York" });

    expect(res.body.data.range).toEqual({
      start: "2026-10-26T04:00:00.000Z", // Monday midnight EDT (UTC-4)
      end: "2026-11-02T05:00:00.000Z", // next Monday midnight EST (UTC-5)
    });
    expect(res.body.data.dailyBreakdown.at(-1)).toMatchObject({
      date: "2026-11-01",
      trackedSeconds: 1800,
    });
    expect(res.body.data.totalTrackedSeconds).toBe(1800);
  });

  it.each([
    ["an impossible date", { startDate: "2026-02-30" }],
    ["a non-ISO date", { startDate: "28-09-2026" }],
    ["an unknown timezone", { timezone: "Mars/Olympus_Mons" }],
  ])("rejects %s with 422", async (_case, query) => {
    const res = await weekly(userA, query);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("aggregation", () => {
  beforeEach(() => setNow(WEDNESDAY_AFTERNOON));

  it("aggregates logs per day and per week, keeping zero-activity days", async () => {
    const a = await newTask(userA, "Task A");
    const b = await newTask(userA, "Task B");
    await seedLog(userA, a, "2026-09-07T09:00:00Z", "2026-09-07T11:00:00Z"); // Mon 2h
    await seedLog(userA, b, "2026-09-07T13:00:00Z", "2026-09-07T13:30:00Z"); // Mon 30m
    await seedLog(userA, a, "2026-09-09T08:00:00Z", "2026-09-09T09:00:00Z"); // Wed 1h
    await seedLog(userA, a, "2026-08-31T08:00:00Z", "2026-08-31T09:00:00Z"); // last week

    const { body } = await weekly(userA);

    expect(secondsByDay(body.data.dailyBreakdown)).toEqual({
      "2026-09-07": 2.5 * HOUR,
      "2026-09-08": 0,
      "2026-09-09": HOUR,
      "2026-09-10": 0,
      "2026-09-11": 0,
      "2026-09-12": 0,
      "2026-09-13": 0,
    });
    expect(body.data.dailyBreakdown[0].tasksWorkedOn).toBe(2);
    expect(body.data.dailyBreakdown[2].tasksWorkedOn).toBe(1);
    expect(body.data).toMatchObject({
      totalTrackedSeconds: 3.5 * HOUR,
      totalTrackedFormatted: "3h 30m",
      // Task A worked on Monday and Wednesday counts once.
      tasksWorkedOn: 2,
      // 3.5h over the 3 days elapsed so far (Mon–Wed).
      averageDailySeconds: 4200,
      averageDailyFormatted: "1h 10m",
    });
  });

  it("averages a past week over all 7 days", async () => {
    const task = await newTask(userA, "Last week");
    await seedLog(userA, task, "2026-09-01T09:00:00Z", "2026-09-01T16:00:00Z"); // 7h

    const { body } = await weekly(userA, { startDate: "2026-08-31" });

    expect(body.data).toMatchObject({ totalTrackedSeconds: 7 * HOUR, averageDailySeconds: HOUR });
  });

  it("includes the running timer, and never in days that haven't started", async () => {
    const task = await newTask(userA, "Deep work");
    await seedLog(userA, task, "2026-09-09T14:00:00Z", null); // running for 1h

    const { body } = await weekly(userA);

    expect(body.data.totalTrackedSeconds).toBe(HOUR);
    expect(body.data.dailyBreakdown[2]).toMatchObject({ trackedSeconds: HOUR, tasksWorkedOn: 1 });
    for (const day of body.data.dailyBreakdown.slice(3)) {
      expect(day).toMatchObject({ trackedSeconds: 0, tasksWorkedOn: 0, isFuture: true });
    }
    expect(body.data.topTasks).toEqual([
      { taskId: task, title: "Deep work", trackedSeconds: HOUR },
    ]);
  });

  it("splits a log crossing midnight between the two days", async () => {
    const task = await newTask(userA, "Late night");
    await seedLog(userA, task, "2026-09-07T23:30:00Z", "2026-09-08T00:30:00Z");

    const { body } = await weekly(userA);

    expect(body.data.dailyBreakdown[0]).toMatchObject({ trackedSeconds: 1800, tasksWorkedOn: 1 });
    expect(body.data.dailyBreakdown[1]).toMatchObject({ trackedSeconds: 1800, tasksWorkedOn: 1 });
    expect(body.data).toMatchObject({ totalTrackedSeconds: HOUR, tasksWorkedOn: 1 });
  });

  it("splits a running timer that started before midnight", async () => {
    const task = await newTask(userA, "Overnight");
    await seedLog(userA, task, "2026-09-08T23:00:00Z", null);
    setNow("2026-09-09T01:00:00Z");

    const { body } = await weekly(userA);

    expect(secondsByDay(body.data.dailyBreakdown)).toMatchObject({
      "2026-09-08": HOUR,
      "2026-09-09": HOUR,
    });
    expect(body.data.totalTrackedSeconds).toBe(2 * HOUR);
  });

  it("clips a log crossing the week boundary to each week", async () => {
    const task = await newTask(userA, "Sunday night");
    // Sunday 23:00 of last week → Monday 01:00 of this week.
    await seedLog(userA, task, "2026-09-06T23:00:00Z", "2026-09-07T01:00:00Z");

    const thisWeek = await weekly(userA);
    const lastWeek = await weekly(userA, { startDate: "2026-08-31" });

    expect(thisWeek.body.data.totalTrackedSeconds).toBe(HOUR);
    expect(thisWeek.body.data.dailyBreakdown[0].trackedSeconds).toBe(HOUR);
    expect(thisWeek.body.data.topTasks[0].trackedSeconds).toBe(HOUR);
    expect(lastWeek.body.data.totalTrackedSeconds).toBe(HOUR);
    expect(lastWeek.body.data.dailyBreakdown[6].trackedSeconds).toBe(HOUR);
  });

  it("makes the daily entries add up to the weekly totals", async () => {
    const tasks = [await newTask(userA, "One"), await newTask(userA, "Two")];
    await seedLog(userA, tasks[0], "2026-09-07T22:10:00Z", "2026-09-08T02:25:00Z");
    await seedLog(userA, tasks[1], "2026-09-08T10:00:00Z", "2026-09-08T10:07:00Z");
    await seedLog(userA, tasks[1], "2026-09-09T14:21:00Z", null);

    const { body } = await weekly(userA);
    const days: Day[] = body.data.dailyBreakdown;

    expect(days.reduce((sum, day) => sum + day.trackedSeconds, 0)).toBe(
      body.data.totalTrackedSeconds,
    );
    expect(body.data.totalTrackedSeconds).toBe((4 * 60 + 15 + 7 + 39) * 60);
  });
});

describe("top tasks", () => {
  beforeEach(() => setNow(WEDNESDAY_AFTERNOON));

  it("orders tasks by time tracked in the week and returns at most 5", async () => {
    for (let i = 1; i <= 6; i++) {
      const task = await newTask(userA, `Task ${i}`);
      // Task i gets 2 × i minutes, split over Monday and Tuesday.
      await seedLog(userA, task, `2026-09-07T0${i}:00:00Z`, `2026-09-07T0${i}:0${i}:00Z`);
      await seedLog(userA, task, `2026-09-08T0${i}:00:00Z`, `2026-09-08T0${i}:0${i}:00Z`);
    }

    const { body } = await weekly(userA);

    expect(body.data.tasksWorkedOn).toBe(6);
    expect(body.data.topTasks.map((t: { title: string }) => t.title)).toEqual([
      "Task 6",
      "Task 5",
      "Task 4",
      "Task 3",
      "Task 2",
    ]);
  });

  it("ranks by the week's time only, not all-time totals", async () => {
    const oldFavourite = await newTask(userA, "Old favourite");
    const thisWeeks = await newTask(userA, "This week's focus");
    await seedLog(userA, oldFavourite, "2026-08-25T08:00:00Z", "2026-08-25T18:00:00Z");
    await seedLog(userA, oldFavourite, "2026-09-08T08:00:00Z", "2026-09-08T08:10:00Z");
    await seedLog(userA, thisWeeks, "2026-09-08T09:00:00Z", "2026-09-08T11:00:00Z");

    const { body } = await weekly(userA);

    expect(body.data.topTasks).toEqual([
      { taskId: thisWeeks, title: "This week's focus", trackedSeconds: 2 * HOUR },
      { taskId: oldFavourite, title: "Old favourite", trackedSeconds: 600 },
    ]);
  });
});

describe("completed tasks", () => {
  it("counts completions by completion time, per week and per day", async () => {
    setNow("2026-09-03T10:00:00Z"); // Thursday of last week
    await setStatus(userA, await newTask(userA, "Done last week"), "COMPLETED");

    setNow("2026-09-08T10:00:00Z"); // Tuesday
    await setStatus(userA, await newTask(userA, "Done Tuesday"), "COMPLETED");
    setNow("2026-09-09T10:00:00Z"); // Wednesday
    const inProgress = await newTask(userA, "Done Wednesday");
    await setStatus(userA, inProgress, "IN_PROGRESS");
    await setStatus(userA, inProgress, "COMPLETED");
    await newTask(userA, "Still pending");

    setNow(WEDNESDAY_AFTERNOON);
    const thisWeek = await weekly(userA);
    const lastWeek = await weekly(userA, { startDate: "2026-08-31" });

    expect(thisWeek.body.data.completedTasks).toBe(2);
    expect(
      thisWeek.body.data.dailyBreakdown.map((day: Day) => day.completedTasks).slice(0, 3),
    ).toEqual([0, 1, 1]);
    expect(lastWeek.body.data.completedTasks).toBe(1);
    expect(lastWeek.body.data.dailyBreakdown[3].completedTasks).toBe(1);
  });

  it("doesn't count a task that is COMPLETED now but was completed in another week", async () => {
    setNow("2026-09-01T10:00:00Z");
    const task = await newTask(userA, "Finished long ago");
    await setStatus(userA, task, "COMPLETED");

    setNow(WEDNESDAY_AFTERNOON);
    // Re-saving the same status must not move the completion time.
    await setStatus(userA, task, "COMPLETED");

    const { body } = await weekly(userA);
    expect(body.data.completedTasks).toBe(0);
  });

  it("stops counting a completion once the task is reopened", async () => {
    setNow("2026-09-08T10:00:00Z");
    const task = await newTask(userA, "Reopened");
    await setStatus(userA, task, "COMPLETED");
    await setStatus(userA, task, "IN_PROGRESS");

    setNow(WEDNESDAY_AFTERNOON);
    const { body } = await weekly(userA);
    expect(body.data.completedTasks).toBe(0);
  });

  it("counts a task completed, reopened and completed again once, on the final day", async () => {
    setNow("2026-09-07T10:00:00Z");
    const task = await newTask(userA, "Second attempt");
    await setStatus(userA, task, "COMPLETED");
    await setStatus(userA, task, "IN_PROGRESS");
    setNow("2026-09-09T10:00:00Z");
    await setStatus(userA, task, "COMPLETED");

    setNow(WEDNESDAY_AFTERNOON);
    const { body } = await weekly(userA);

    expect(body.data.completedTasks).toBe(1);
    expect(body.data.dailyBreakdown.map((day: Day) => day.completedTasks).slice(0, 3)).toEqual([
      0, 0, 1,
    ]);
  });

  it("records completedAt from the server clock on each transition", async () => {
    setNow("2026-09-08T10:00:00Z");
    const task = await newTask(userA, "Lifecycle");

    const done = await setStatus(userA, task, "COMPLETED");
    expect(done.body.data.task.completedAt).toBe("2026-09-08T10:00:00.000Z");

    const reopened = await setStatus(userA, task, "IN_PROGRESS");
    expect(reopened.body.data.task.completedAt).toBeNull();

    setNow("2026-09-09T11:00:00Z");
    const redone = await setStatus(userA, task, "COMPLETED");
    expect(redone.body.data.task.completedAt).toBe("2026-09-09T11:00:00.000Z");
  });
});

describe("isolation between users", () => {
  it("never includes another user's time, tasks, completions, or timer", async () => {
    setNow(WEDNESDAY_AFTERNOON);
    const own = await newTask(userA, "A's task");
    await seedLog(userA, own, "2026-09-08T09:00:00Z", "2026-09-08T09:30:00Z");

    const foreign = await newTask(userB, "B's secret task");
    await seedLog(userB, foreign, "2026-09-07T10:00:00Z", "2026-09-07T13:00:00Z");
    await seedLog(userB, foreign, "2026-09-09T14:00:00Z", null);
    await setStatus(userB, await newTask(userB, "B done"), "COMPLETED");

    const a = await weekly(userA);
    const b = await weekly(userB);

    expect(a.body.data).toMatchObject({
      totalTrackedSeconds: 1800,
      tasksWorkedOn: 1,
      completedTasks: 0,
      topTasks: [{ taskId: own, title: "A's task", trackedSeconds: 1800 }],
    });
    expect(secondsByDay(a.body.data.dailyBreakdown)).toMatchObject({
      "2026-09-07": 0,
      "2026-09-08": 1800,
      "2026-09-09": 0,
    });
    expect(JSON.stringify(a.body)).not.toContain("B's secret task");
    expect(b.body.data).toMatchObject({
      totalTrackedSeconds: 4 * HOUR,
      tasksWorkedOn: 1,
      completedTasks: 1,
    });
  });
});
