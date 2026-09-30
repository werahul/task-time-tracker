export interface DailyTopTask {
  taskId: string;
  title: string;
  /** Seconds tracked on this task within the day (midnight-crossing logs clipped). */
  trackedSeconds: number;
}

export interface DailySummary {
  /** The calendar day summarized, YYYY-MM-DD, in `timezone`. */
  date: string;
  /** IANA timezone that defines the day's boundaries. */
  timezone: string;
  /** The day as a half-open UTC range [start, end). 23h/25h on DST changes. */
  range: { start: string; end: string };
  /** Whether `date` is today in `timezone` (the only day that can still grow). */
  isToday: boolean;
  /** Time tracked within the day, including the running timer's elapsed part. */
  totalTrackedSeconds: number;
  totalTrackedFormatted: string;
  /** Distinct tasks with at least one time log overlapping the day. */
  tasksWorkedOn: number;
  /** Tasks whose completion time falls within the day. */
  completedTasks: number;
  /** Current open workload (a snapshot as of now, not historical). */
  pendingTasks: number;
  inProgressTasks: number;
  /** The user's running timer, if any (current state). */
  activeTimer: {
    taskId: string;
    title: string;
    startedAt: string;
    elapsedSeconds: number;
  } | null;
  /** Up to 5 tasks by time tracked within the day, most first. */
  topTasks: DailyTopTask[];
  /** Deterministic, human-readable observations derived from the numbers above. */
  insights: string[];
}

/** One calendar day of a weekly summary. Every day of the week is present. */
export interface WeeklyDay {
  /** YYYY-MM-DD in the summary's timezone. */
  date: string;
  /** Time tracked within the day (midnight-crossing logs clipped); 0 if none. */
  trackedSeconds: number;
  /** Distinct tasks with at least one time log overlapping the day. */
  tasksWorkedOn: number;
  /** Tasks whose completion time falls within the day. */
  completedTasks: number;
  /** The day hasn't started yet (later this week), so it can't have data. */
  isFuture: boolean;
}

/** Up to 5 tasks by time tracked within the week, most first. */
export type WeeklyTopTask = DailyTopTask;

export interface WeeklySummary {
  /** Monday of the week, YYYY-MM-DD, in `timezone`. */
  startDate: string;
  /** Sunday of the week (inclusive), YYYY-MM-DD, in `timezone`. */
  endDate: string;
  /** IANA timezone that defines the days' boundaries. */
  timezone: string;
  /** The week as a half-open UTC range [start, end). */
  range: { start: string; end: string };
  /** Whether the week contains today in `timezone` (the only week that can still grow). */
  isCurrentWeek: boolean;
  /** Days of the week that have started: 7 for past weeks, 1–7 for the current week. */
  elapsedDays: number;
  /** Time tracked within the week, including the running timer's elapsed part. */
  totalTrackedSeconds: number;
  totalTrackedFormatted: string;
  /**
   * totalTrackedSeconds / elapsedDays, rounded down. Idle days count (it's the
   * average over calendar days, not over active days); days that haven't
   * happened yet don't.
   */
  averageDailySeconds: number;
  averageDailyFormatted: string;
  /** Distinct tasks with at least one time log overlapping the week. */
  tasksWorkedOn: number;
  /** Tasks whose completion time falls within the week. */
  completedTasks: number;
  /** Exactly 7 entries, Monday → Sunday. */
  dailyBreakdown: WeeklyDay[];
  topTasks: WeeklyTopTask[];
}
