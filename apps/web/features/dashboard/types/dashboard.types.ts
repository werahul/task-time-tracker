import type { DailySummary } from "@task-time-tracker/shared";

/**
 * The server's summary plus the local time it arrived, so the running timer's
 * contribution to today's total can tick forward from the server's value.
 */
export interface DailySummaryState extends DailySummary {
  receivedAt: number;
}
