"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard.api";
import { browserTimeZone } from "../date";
import { dashboardKeys } from "../query-keys";

/**
 * Read-only weekly analytics. No polling: the summary is refreshed when task
 * and timer mutations invalidate the ["dashboard"] keys (timer stop, task
 * completion, …), which is as fresh as weekly numbers need to be.
 */
export function useWeeklySummary(startDate: string, enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.weeklySummary(startDate),
    queryFn: () => dashboardApi.weeklySummary(startDate, browserTimeZone()),
    enabled,
  });
}
