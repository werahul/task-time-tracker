import type { Paginated } from "./pagination";

/** A timer session as serialized over the wire (dates are ISO strings, UTC). */
export interface TimeLog {
  id: string;
  taskId: string;
  task: { id: string; title: string };
  startedAt: string;
  /** null while the timer is running. */
  stoppedAt: string | null;
  /** Whole seconds, computed by the server on stop; 0 while running. */
  durationSeconds: number;
}

/**
 * The running timer. `elapsedSeconds`/`elapsedMs` are computed by the server at
 * response time so clients can render elapsed time without trusting their own
 * clock's absolute value — only the interval since the response arrived.
 */
export interface ActiveTimer extends TimeLog {
  stoppedAt: null;
  /** Whole seconds, for display. */
  elapsedSeconds: number;
  /** Milliseconds: anchor a live clock on this so a reload never loses the fraction. */
  elapsedMs: number;
}

export interface TaskTimeLogs extends Paginated<TimeLog> {
  /** SUM(durationSeconds) over the task's completed sessions. */
  totalSeconds: number;
}
