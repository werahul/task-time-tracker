import type { DailySummary, WeeklySummary } from "@task-time-tracker/shared";
import { api } from "@/lib/api/client";

export const dashboardApi = {
  /** `timezone` is the viewer's IANA zone, so "today" means their today. */
  dailySummary: (date: string, timezone: string) =>
    api.get<DailySummary>(
      `/dashboard/daily-summary?${new URLSearchParams({ date, timezone }).toString()}`,
    ),

  /** The Monday → Sunday week containing `startDate`, in the viewer's timezone. */
  weeklySummary: (startDate: string, timezone: string) =>
    api.get<WeeklySummary>(
      `/dashboard/weekly-summary?${new URLSearchParams({ startDate, timezone }).toString()}`,
    ),
};
