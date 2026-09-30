import { formatDuration } from "@task-time-tracker/shared";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import {
  timeTrackingService,
  calculateDurationSeconds,
} from "../time-tracking/time-tracking.service";
import { dashboardRepository } from "./dashboard.repository";
import type { DailySummaryQuery, WeeklySummaryQuery } from "./dashboard.schema";
import type { DailySummaryRecord, WeeklySummaryRecord } from "./dashboard.types";

const TOP_TASK_LIMIT = 5;

const dateInFuture = (message: string) => new AppError(422, "DATE_IN_FUTURE", message);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Deterministic, human-readable observations built only from the summary's numbers. */
export function buildInsights(summary: Omit<DailySummaryRecord, "insights">): string[] {
  const { totalTrackedSeconds, tasksWorkedOn, completedTasks, topTasks, isToday } = summary;
  const insights: string[] = [];

  if (totalTrackedSeconds === 0) {
    insights.push(isToday ? "No time tracked yet today." : "No time was tracked on this day.");
  } else {
    insights.push(
      `You tracked ${formatDuration(totalTrackedSeconds)} ${isToday ? "today" : "on this day"} across ${plural(tasksWorkedOn, "task")}.`,
    );
  }

  if (completedTasks > 0) {
    insights.push(`You completed ${plural(completedTasks, "task")}.`);
  }

  const [top] = topTasks;
  if (top && tasksWorkedOn > 1) {
    insights.push(
      `Your most time-intensive task was “${top.title}” (${formatDuration(top.trackedSeconds)}).`,
    );
  } else if (top) {
    insights.push(`All of it went to “${top.title}”.`);
  }

  return insights;
}

/**
 * A read-only aggregation layer: Tasks and TimeLogs stay the source of truth,
 * and every number here is computed by PostgreSQL for the authenticated user.
 */
export const dashboardService = {
  async getDailySummary(userId: string, query: DailySummaryQuery): Promise<DailySummaryRecord> {
    const timezone = query.timezone ?? env.APP_TIMEZONE;
    const now = new Date(); // one clock reading for every query in this summary

    const day = await dashboardRepository.resolveDay(query.date, timezone, now);
    // YYYY-MM-DD strings compare correctly as text.
    if (day.date > day.today) {
      throw dateInFuture("No productivity data is available for a future date.");
    }

    const [trackedSeconds, tasksWorkedOn, statusCounts, topTasks, running] = await Promise.all([
      dashboardRepository.getDailyTrackedSeconds(userId, day, now),
      dashboardRepository.getTasksWorkedOnCount(userId, day, now),
      dashboardRepository.getDailyTaskStatusCounts(userId, day),
      dashboardRepository.getDailyTaskTimeBreakdown(userId, day, now, TOP_TASK_LIMIT),
      timeTrackingService.getActiveTimer(userId),
    ]);

    const summary: Omit<DailySummaryRecord, "insights"> = {
      date: day.date,
      timezone,
      range: { start: day.start, end: day.end },
      isToday: day.date === day.today,
      totalTrackedSeconds: trackedSeconds,
      totalTrackedFormatted: formatDuration(trackedSeconds),
      tasksWorkedOn,
      completedTasks: statusCounts.completedInDay,
      pendingTasks: statusCounts.pending,
      inProgressTasks: statusCounts.inProgress,
      activeTimer: running && {
        taskId: running.taskId,
        title: running.task.title,
        startedAt: running.startedAt,
        elapsedSeconds: calculateDurationSeconds(running.startedAt, now),
      },
      topTasks,
    };

    return { ...summary, insights: buildInsights(summary) };
  },

  /**
   * Monday → Sunday. Days are aggregated one by one (each clipped to its own
   * boundaries), and the weekly total is their sum, so the chart's bars always
   * add up to the headline number.
   */
  async getWeeklySummary(userId: string, query: WeeklySummaryQuery): Promise<WeeklySummaryRecord> {
    const timezone = query.timezone ?? env.APP_TIMEZONE;
    const now = new Date(); // one clock reading for every query in this summary

    const week = await dashboardRepository.resolveWeek(query.startDate, timezone, now);
    // YYYY-MM-DD strings compare correctly as text.
    if (week.startDate > week.today) {
      throw dateInFuture("No productivity data is available for a future week.");
    }

    const [dailyBreakdown, counts, topTasks] = await Promise.all([
      dashboardRepository.getDailyBreakdown(userId, week, timezone, now),
      dashboardRepository.getWeeklyTaskCounts(userId, week, now),
      dashboardRepository.getWeeklyTopTasks(userId, week, now, TOP_TASK_LIMIT),
    ]);

    const totalTrackedSeconds = dailyBreakdown.reduce((sum, day) => sum + day.trackedSeconds, 0);
    // Average over the days that have started: an idle Tuesday counts, but
    // Friday doesn't lower the average while it's still Wednesday.
    const elapsedDays = dailyBreakdown.filter((day) => !day.isFuture).length;
    const averageDailySeconds = Math.floor(totalTrackedSeconds / elapsedDays);

    return {
      startDate: week.startDate,
      endDate: week.endDate,
      timezone,
      range: { start: week.start, end: week.end },
      isCurrentWeek: week.today <= week.endDate,
      elapsedDays,
      totalTrackedSeconds,
      totalTrackedFormatted: formatDuration(totalTrackedSeconds),
      averageDailySeconds,
      averageDailyFormatted: formatDuration(averageDailySeconds),
      tasksWorkedOn: counts.tasksWorkedOn,
      completedTasks: counts.completedTasks,
      dailyBreakdown,
      topTasks,
    };
  },
};
