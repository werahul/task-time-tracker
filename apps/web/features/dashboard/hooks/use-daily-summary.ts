"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard.api";
import { browserTimeZone } from "../date";
import { dashboardKeys } from "../query-keys";
import type { DailySummaryState } from "../types/dashboard.types";

/**
 * Read-only view over tasks and time logs. Invalidated by every task and timer
 * mutation; today's summary also re-syncs every minute while a timer can run.
 */
export function useDailySummary(date: string, enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.dailySummary(date),
    queryFn: async (): Promise<DailySummaryState> => ({
      ...(await dashboardApi.dailySummary(date, browserTimeZone())),
      receivedAt: Date.now(),
    }),
    enabled,
    refetchInterval: (query) => (query.state.data?.isToday ? 60_000 : false),
  });
}
