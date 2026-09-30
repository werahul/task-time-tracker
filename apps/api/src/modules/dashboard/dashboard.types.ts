import type { DailyTopTask, WeeklyDay, WeeklySummary } from "@task-time-tracker/shared";

/** A calendar day in a timezone, as a half-open UTC range [start, end). */
export interface DayWindow {
  /** YYYY-MM-DD */
  date: string;
  start: Date;
  end: Date;
  /** Today's date (YYYY-MM-DD) in the same timezone. */
  today: string;
}

export interface TaskStatusCounts {
  completedInDay: number;
  pending: number;
  inProgress: number;
}

export type TaskTimeBreakdownRow = DailyTopTask;

/** Service result; serialized to the shared `DailySummary` wire type. */
export interface DailySummaryRecord {
  date: string;
  timezone: string;
  range: { start: Date; end: Date };
  isToday: boolean;
  totalTrackedSeconds: number;
  totalTrackedFormatted: string;
  tasksWorkedOn: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  activeTimer: { taskId: string; title: string; startedAt: Date; elapsedSeconds: number } | null;
  topTasks: DailyTopTask[];
  insights: string[];
}

/** A Monday → Sunday week in a timezone, as a half-open UTC range [start, end). */
export interface WeekWindow {
  /** Monday, YYYY-MM-DD */
  startDate: string;
  /** Sunday (inclusive), YYYY-MM-DD */
  endDate: string;
  start: Date;
  end: Date;
  /** Today's date (YYYY-MM-DD) in the same timezone. */
  today: string;
}

export type WeeklyDayRow = WeeklyDay;

export interface WeeklyTaskCounts {
  tasksWorkedOn: number;
  completedTasks: number;
}

/** Service result; serialized to the shared `WeeklySummary` wire type. */
export interface WeeklySummaryRecord extends Omit<WeeklySummary, "range"> {
  range: { start: Date; end: Date };
}
