import { Prisma } from "@prisma/client";
import { isPrismaError, prisma, type DbClient } from "../../lib/prisma";
import type { PageWindow, TimeLogFilters, TimeLogRecord } from "./time-tracking.types";

const timeLogSelect = {
  id: true,
  taskId: true,
  task: { select: { id: true, title: true } },
  startedAt: true,
  stoppedAt: true,
  durationSeconds: true,
} satisfies Prisma.TimeLogSelect;

function userLogsWhere(userId: string, { taskId, from, to }: TimeLogFilters) {
  return {
    userId,
    taskId,
    startedAt: from || to ? { gte: from, lt: to } : undefined,
  } satisfies Prisma.TimeLogWhereInput;
}

/** Every query is scoped by the owner's userId inside the database query itself. */
export const timeTrackingRepository = {
  /** Throws P2002 if the user already has a running timer (partial unique index). */
  createTimeLog(
    data: { userId: string; taskId: string; startedAt: Date },
    db: DbClient = prisma,
  ): Promise<TimeLogRecord> {
    return db.timeLog.create({ data: { ...data, durationSeconds: 0 }, select: timeLogSelect });
  },

  findActiveTimerByUser(userId: string): Promise<TimeLogRecord | null> {
    return prisma.timeLog.findFirst({ where: { userId, stoppedAt: null }, select: timeLogSelect });
  },

  findActiveTimerByUserAndTask(userId: string, taskId: string): Promise<TimeLogRecord | null> {
    return prisma.timeLog.findFirst({
      where: { userId, taskId, stoppedAt: null },
      select: timeLogSelect,
    });
  },

  /**
   * Stops the timer only if it is still running (`stoppedAt IS NULL` in the
   * WHERE clause), so two concurrent stops can't both succeed. Returns null
   * when this request lost that race.
   */
  async stopTimeLog(
    userId: string,
    timeLogId: string,
    result: { stoppedAt: Date; durationSeconds: number },
  ): Promise<TimeLogRecord | null> {
    try {
      return await prisma.timeLog.update({
        where: { id: timeLogId, userId, stoppedAt: null },
        data: result,
        select: timeLogSelect,
      });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return null;
      throw error;
    }
  },

  /**
   * Stops the task's running timer, if any, at `stoppedAt` (clamped to its
   * start). The duration is computed in SQL with the same formula as the
   * table's CHECK constraint. Conditional on `stoppedAt IS NULL`, so it can't
   * race a concurrent stop. Returns whether a timer was stopped.
   */
  async stopActiveTimerForTask(
    userId: string,
    taskId: string,
    stoppedAt: Date,
    db: DbClient = prisma,
  ): Promise<boolean> {
    const at = Prisma.sql`${stoppedAt.toISOString()}::timestamptz`;
    const count = await db.$executeRaw`
      UPDATE "TimeLog"
      SET "stoppedAt" = GREATEST(${at}, "startedAt"),
          "durationSeconds" = floor(extract(epoch FROM GREATEST(${at}, "startedAt") - "startedAt"))::integer,
          "updatedAt" = ${at}
      WHERE "userId" = ${userId}::uuid AND "taskId" = ${taskId}::uuid AND "stoppedAt" IS NULL`;
    return count > 0;
  },

  findTimeLogsByUser(
    userId: string,
    filters: TimeLogFilters,
    { skip, take }: PageWindow,
  ): Promise<TimeLogRecord[]> {
    return prisma.timeLog.findMany({
      where: userLogsWhere(userId, filters),
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: timeLogSelect,
    });
  },

  countTimeLogsByUser(userId: string, filters: TimeLogFilters): Promise<number> {
    return prisma.timeLog.count({ where: userLogsWhere(userId, filters) });
  },

  findTimeLogsByTaskForUser(userId: string, taskId: string, page: PageWindow) {
    return timeTrackingRepository.findTimeLogsByUser(userId, { taskId }, page);
  },

  /** SUM(durationSeconds) of the task's completed sessions, computed in PostgreSQL. */
  async getTotalTimeByTask(userId: string, taskId: string): Promise<number> {
    const { _sum } = await prisma.timeLog.aggregate({
      where: { userId, taskId, stoppedAt: { not: null } },
      _sum: { durationSeconds: true },
    });
    return _sum.durationSeconds ?? 0;
  },
};
