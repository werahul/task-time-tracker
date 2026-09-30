import type { ActiveTimer } from "@task-time-tracker/shared";

/**
 * The running timer plus a client-side anchor: the local timestamp at which
 * the timer would have started, derived as `receivedAt - elapsedMs`.
 * Using it means the display only depends on the local clock measuring
 * *intervals*, so a wrong device clock can't skew the elapsed time.
 */
export interface ActiveTimerState extends ActiveTimer {
  anchorMs: number;
}
