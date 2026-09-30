/** A time log as returned by the repository. Serialized to the shared `TimeLog` wire type. */
export interface TimeLogRecord {
  id: string;
  taskId: string;
  task: { id: string; title: string };
  startedAt: Date;
  stoppedAt: Date | null;
  durationSeconds: number;
}

export interface ActiveTimerRecord extends TimeLogRecord {
  stoppedAt: null;
  elapsedSeconds: number;
  elapsedMs: number;
}

export interface TimeLogFilters {
  taskId?: string;
  /** Inclusive lower bound on startedAt. */
  from?: Date;
  /** Exclusive upper bound on startedAt. */
  to?: Date;
}

export interface PageWindow {
  skip: number;
  take: number;
}
