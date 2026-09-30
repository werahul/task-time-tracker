// Durations are stored as whole seconds; `formatDuration` lives in
// @task-time-tracker/shared so the API's summary text matches the UI.

/** 5077 → "01:24:37" — for a running timer. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const parts = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday", or e.g. "Mon, Sep 28" in the viewer's timezone. */
export function formatDayLabel(date: Date, now = new Date()): string {
  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return dateFormatter.format(date);
}

/** "Today · 10:30 AM – 11:45 AM" (or "… – now" while running). */
export function formatSessionTime(startedAt: string, stoppedAt: string | null): string {
  const start = new Date(startedAt);
  const end = stoppedAt ? timeFormatter.format(new Date(stoppedAt)) : "now";
  return `${formatDayLabel(start)} · ${timeFormatter.format(start)} – ${end}`;
}
