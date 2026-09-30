export const dashboardKeys = {
  all: ["dashboard"] as const,
  dailySummary: (date: string) => ["dashboard", "daily-summary", date] as const,
  weeklySummary: (startDate: string) => ["dashboard", "weekly-summary", startDate] as const,
};
