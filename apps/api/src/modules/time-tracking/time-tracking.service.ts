import type { PaginationQuery, Paginated } from "@task-time-tracker/shared";
import { isPrismaError, runInTransaction } from "../../lib/prisma";
import { TaskErrors } from "../tasks/task.errors";
import { taskRepository } from "../tasks/task.repository";
import { taskService } from "../tasks/task.service";
import { TimeTrackingErrors } from "./time-tracking.errors";
import { timeTrackingRepository } from "./time-tracking.repository";
import type { ListTimeLogsQuery } from "./time-tracking.schema";
import type { ActiveTimerRecord, TimeLogRecord } from "./time-tracking.types";

/** Whole seconds between two instants; never negative. */
export function calculateDurationSeconds(startedAt: Date, stoppedAt: Date): number {
  return Math.max(0, Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000));
}

function toActiveTimer(log: TimeLogRecord, now = new Date()): ActiveTimerRecord {
  return {
    ...log,
    stoppedAt: null,
    elapsedSeconds: calculateDurationSeconds(log.startedAt, now),
    elapsedMs: Math.max(0, now.getTime() - log.startedAt.getTime()),
  };
}

function paginate<T>(items: T[], total: number, { page, limit }: PaginationQuery): Paginated<T> {
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * The backend owns the timer: every timestamp and duration is produced here
 * from the server clock. `userId` always comes from the authenticated session.
 */
export const timeTrackingService = {
  async startTimer(userId: string, taskId: string): Promise<ActiveTimerRecord> {
    const task = await taskService.getTask(userId, taskId); // 404 if not the user's
    if (task.status === "COMPLETED") throw TimeTrackingErrors.taskCompleted();

    // Friendly pre-check; the partial unique index below is the real guarantee.
    const running = await timeTrackingRepository.findActiveTimerByUser(userId);
    if (running) throw TimeTrackingErrors.activeTimerExists(running.taskId === taskId);

    try {
      const log = await runInTransaction(async (db) => {
        const created = await timeTrackingRepository.createTimeLog(
          { userId, taskId, startedAt: new Date() },
          db,
        );
        await taskRepository.markInProgressIfPending(userId, taskId, db);
        return created;
      });
      return toActiveTimer(log, log.startedAt);
    } catch (error) {
      // A concurrent start won the race to the one-active-timer-per-user index.
      if (isPrismaError(error, "P2002")) throw TimeTrackingErrors.activeTimerExists(false);
      // The task was deleted between the ownership check and the insert.
      if (isPrismaError(error, "P2003")) throw TaskErrors.notFound();
      throw error;
    }
  },

  async stopTimer(userId: string, taskId: string): Promise<TimeLogRecord> {
    await taskService.getTask(userId, taskId); // 404 if not the user's

    const running = await timeTrackingRepository.findActiveTimerByUserAndTask(userId, taskId);
    if (!running) throw TimeTrackingErrors.activeTimerNotFound();

    // Clamp so clock skew between API instances can never yield stoppedAt < startedAt.
    const stoppedAt = new Date(Math.max(Date.now(), running.startedAt.getTime()));
    const stopped = await timeTrackingRepository.stopTimeLog(userId, running.id, {
      stoppedAt,
      durationSeconds: calculateDurationSeconds(running.startedAt, stoppedAt),
    });

    if (!stopped) throw TimeTrackingErrors.timerAlreadyStopped();
    return stopped;
  },

  async getActiveTimer(userId: string): Promise<ActiveTimerRecord | null> {
    const running = await timeTrackingRepository.findActiveTimerByUser(userId);
    return running ? toActiveTimer(running) : null;
  },

  async listTimeLogs(userId: string, query: ListTimeLogsQuery): Promise<Paginated<TimeLogRecord>> {
    const { taskId, from, to, page, limit } = query;
    const filters = { taskId, from, to };
    const [items, total] = await Promise.all([
      timeTrackingRepository.findTimeLogsByUser(userId, filters, {
        skip: (page - 1) * limit,
        take: limit,
      }),
      timeTrackingRepository.countTimeLogsByUser(userId, filters),
    ]);
    return paginate(items, total, query);
  },

  async listTaskTimeLogs(
    userId: string,
    taskId: string,
    query: PaginationQuery,
  ): Promise<Paginated<TimeLogRecord> & { totalSeconds: number }> {
    await taskService.getTask(userId, taskId); // 404 if not the user's

    const { page, limit } = query;
    const [items, total, totalSeconds] = await Promise.all([
      timeTrackingRepository.findTimeLogsByTaskForUser(userId, taskId, {
        skip: (page - 1) * limit,
        take: limit,
      }),
      timeTrackingRepository.countTimeLogsByUser(userId, { taskId }),
      timeTrackingRepository.getTotalTimeByTask(userId, taskId),
    ]);
    return { ...paginate(items, total, query), totalSeconds };
  },
};
