import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type {
  DayWindow,
  TaskStatusCounts,
  TaskTimeBreakdownRow,
  WeekWindow,
  WeeklyDayRow,
  WeeklyTaskCounts,
} from "./dashboard.types";

// Instants are passed to raw SQL as ISO-8601 strings cast to timestamptz, so
// the result never depends on the database session's TimeZone setting.
const ts = (date: Date) => Prisma.sql`${date.toISOString()}::timestamptz`;

/**
 * A half-open range [start, end) as SQL timestamptz expressions: either bound
 * parameters (one day, one week) or columns (each row of a generated series of
 * days), so the overlap and clipping rules below are written exactly once.
 */
interface SqlWindow {
  start: Prisma.Sql;
  end: Prisma.Sql;
}

const sqlWindow = (window: { start: Date; end: Date }): SqlWindow => ({
  start: ts(window.start),
  end: ts(window.end),
});

/**
 * Logs overlapping [start, end): started before the window ends, and either
 * stopped after it began or still running (effective end = `now`).
 */
function overlapsWindow(userId: string, w: SqlWindow, now: Date) {
  return Prisma.sql`
    l."userId" = ${userId}::uuid
    AND l."startedAt" < ${w.end}
    AND (l."stoppedAt" > ${w.start} OR (l."stoppedAt" IS NULL AND ${ts(now)} > ${w.start}))`;
}

/**
 * Seconds of a log that fall inside the window. A completed log wholly inside
 * it uses its persisted (authoritative) durationSeconds; a log crossing a
 * boundary (e.g. midnight) is clipped to [max(startedAt, start),
 * min(stoppedAt, end)); a running timer's end is the server's `now`.
 * Only apply to rows matched by `overlapsWindow` (GREATEST/LEAST skip NULLs).
 */
function secondsWithinWindow(w: SqlWindow, now: Date) {
  return Prisma.sql`
    CASE
      WHEN l."stoppedAt" IS NOT NULL
        AND l."startedAt" >= ${w.start}
        AND l."stoppedAt" <= ${w.end}
      THEN l."durationSeconds"
      ELSE GREATEST(0, floor(extract(epoch FROM
        LEAST(COALESCE(l."stoppedAt", ${ts(now)}), ${w.end})
        - GREATEST(l."startedAt", ${w.start})
      )))::integer
    END`;
}

/** Tasks ranked by time tracked within the window, most first. */
function taskTimeBreakdown(userId: string, w: SqlWindow, now: Date, limit: number) {
  return prisma.$queryRaw<TaskTimeBreakdownRow[]>`
    SELECT l."taskId" AS "taskId", t."title" AS "title",
           SUM(${secondsWithinWindow(w, now)})::integer AS "trackedSeconds"
    FROM "TimeLog" l
    JOIN "Task" t ON t."id" = l."taskId" AND t."userId" = l."userId"
    WHERE ${overlapsWindow(userId, w, now)}
    GROUP BY l."taskId", t."title"
    ORDER BY "trackedSeconds" DESC, t."title" ASC
    LIMIT ${limit}`;
}

/** Every query is scoped by the authenticated user's id. */
export const dashboardRepository = {
  /**
   * Resolves a calendar day in an IANA timezone to UTC boundaries using
   * PostgreSQL's timezone database, so DST days (23h/25h) are exact.
   * With no `date`, the day is "today" in that timezone as of `now`.
   */
  async resolveDay(date: string | undefined, timeZone: string, now: Date): Promise<DayWindow> {
    const [row] = await prisma.$queryRaw<DayWindow[]>`
      WITH day AS (
        SELECT COALESCE(${date ?? null}::date, (${ts(now)} AT TIME ZONE ${timeZone})::date) AS d
      )
      SELECT
        d::text AS "date",
        (d::timestamp AT TIME ZONE ${timeZone}) AS "start",
        ((d + 1)::timestamp AT TIME ZONE ${timeZone}) AS "end",
        ((${ts(now)} AT TIME ZONE ${timeZone})::date)::text AS "today"
      FROM day`;
    return row;
  },

  async getDailyTrackedSeconds(userId: string, day: DayWindow, now: Date): Promise<number> {
    const w = sqlWindow(day);
    const [row] = await prisma.$queryRaw<{ seconds: number }[]>`
      SELECT COALESCE(SUM(${secondsWithinWindow(w, now)}), 0)::integer AS "seconds"
      FROM "TimeLog" l
      WHERE ${overlapsWindow(userId, w, now)}`;
    return row.seconds;
  },

  /** Distinct tasks with at least one log overlapping the day. */
  async getTasksWorkedOnCount(userId: string, day: DayWindow, now: Date): Promise<number> {
    const [row] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT l."taskId")::integer AS "count"
      FROM "TimeLog" l
      WHERE ${overlapsWindow(userId, sqlWindow(day), now)}`;
    return row.count;
  },

  /** Tasks ranked by time tracked within the day. */
  getDailyTaskTimeBreakdown(
    userId: string,
    day: DayWindow,
    now: Date,
    limit: number,
  ): Promise<TaskTimeBreakdownRow[]> {
    return taskTimeBreakdown(userId, sqlWindow(day), now, limit);
  },

  /** Completions within the day, plus the current open workload. */
  async getDailyTaskStatusCounts(userId: string, day: DayWindow): Promise<TaskStatusCounts> {
    const [completedInDay, open] = await Promise.all([
      prisma.task.count({ where: { userId, completedAt: { gte: day.start, lt: day.end } } }),
      prisma.task.groupBy({
        by: ["status"],
        where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        _count: { _all: true },
      }),
    ]);
    const countFor = (status: string) => open.find((g) => g.status === status)?._count._all ?? 0;
    return { completedInDay, pending: countFor("PENDING"), inProgress: countFor("IN_PROGRESS") };
  },

  /**
   * Resolves the Monday → Sunday week containing `date` (default: today in the
   * timezone as of `now`) to UTC boundaries. Like `resolveDay`, the timezone
   * math runs in PostgreSQL, so weeks spanning a DST change are 167h/169h.
   */
  async resolveWeek(date: string | undefined, timeZone: string, now: Date): Promise<WeekWindow> {
    const [row] = await prisma.$queryRaw<WeekWindow[]>`
      WITH day AS (
        SELECT COALESCE(${date ?? null}::date, (${ts(now)} AT TIME ZONE ${timeZone})::date) AS d
      ), week AS (
        -- ISO day of week: Monday = 1 … Sunday = 7.
        SELECT (d - (extract(isodow FROM d)::integer - 1)) AS monday FROM day
      )
      SELECT
        monday::text AS "startDate",
        (monday + 6)::text AS "endDate",
        (monday::timestamp AT TIME ZONE ${timeZone}) AS "start",
        ((monday + 7)::timestamp AT TIME ZONE ${timeZone}) AS "end",
        ((${ts(now)} AT TIME ZONE ${timeZone})::date)::text AS "today"
      FROM week`;
    return row;
  },

  /**
   * One row per day of the week, Monday → Sunday — including days with no
   * activity — each aggregated over its own [dayStart, dayEnd) window, so a
   * log crossing midnight is split between the two days.
   */
  getDailyBreakdown(
    userId: string,
    week: WeekWindow,
    timeZone: string,
    now: Date,
  ): Promise<WeeklyDayRow[]> {
    const day: SqlWindow = { start: Prisma.sql`d."start"`, end: Prisma.sql`d."end"` };
    return prisma.$queryRaw<WeeklyDayRow[]>`
      WITH days AS (
        SELECT (${week.startDate}::date + i) AS "date",
               ((${week.startDate}::date + i)::timestamp AT TIME ZONE ${timeZone}) AS "start",
               ((${week.startDate}::date + i + 1)::timestamp AT TIME ZONE ${timeZone}) AS "end"
        FROM generate_series(0, 6) AS i
      ), tracked AS (
        SELECT d."date",
               SUM(${secondsWithinWindow(day, now)})::integer AS "seconds",
               COUNT(DISTINCT l."taskId")::integer AS "tasks"
        FROM days d
        JOIN "TimeLog" l ON ${overlapsWindow(userId, day, now)}
        GROUP BY d."date"
      ), completed AS (
        SELECT d."date", COUNT(*)::integer AS "count"
        FROM days d
        JOIN "Task" t ON t."userId" = ${userId}::uuid
          AND t."completedAt" >= d."start" AND t."completedAt" < d."end"
        GROUP BY d."date"
      )
      SELECT d."date"::text AS "date",
             COALESCE(tr."seconds", 0) AS "trackedSeconds",
             COALESCE(tr."tasks", 0) AS "tasksWorkedOn",
             COALESCE(c."count", 0) AS "completedTasks",
             (d."start" > ${ts(now)}) AS "isFuture"
      FROM days d
      LEFT JOIN tracked tr ON tr."date" = d."date"
      LEFT JOIN completed c ON c."date" = d."date"
      ORDER BY d."date"`;
  },

  /**
   * Distinct tasks worked on during the week (a task active on several days
   * counts once), and tasks whose completion time falls within the week.
   */
  async getWeeklyTaskCounts(
    userId: string,
    week: WeekWindow,
    now: Date,
  ): Promise<WeeklyTaskCounts> {
    const [[worked], completedTasks] = await Promise.all([
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT l."taskId")::integer AS "count"
        FROM "TimeLog" l
        WHERE ${overlapsWindow(userId, sqlWindow(week), now)}`,
      prisma.task.count({ where: { userId, completedAt: { gte: week.start, lt: week.end } } }),
    ]);
    return { tasksWorkedOn: worked.count, completedTasks };
  },

  /** Tasks ranked by time tracked within the week. */
  getWeeklyTopTasks(
    userId: string,
    week: WeekWindow,
    now: Date,
    limit: number,
  ): Promise<TaskTimeBreakdownRow[]> {
    return taskTimeBreakdown(userId, sqlWindow(week), now, limit);
  },
};
