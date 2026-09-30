// Calendar dates are YYYY-MM-DD strings in the viewer's local timezone. Day
// arithmetic runs in UTC on those strings so DST shifts can't skip or repeat a day.

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function localIsoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-09-29" → "Tuesday, September 29" (no timezone shift). */
export function formatLongDate(isoDate: string): string {
  return longDateFormatter.format(new Date(`${isoDate}T12:00:00Z`));
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** True for a YYYY-MM-DD string naming a real calendar date. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** The Monday of the Monday → Sunday week containing `isoDate` (the API's week). */
export function startOfWeek(isoDate: string): string {
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // Sunday = 0
  return shiftIsoDate(isoDate, -((weekday + 6) % 7));
}

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
const longWeekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const utcNoon = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);

/** "2026-09-28" → "Mon" */
export const formatWeekday = (isoDate: string) => weekdayFormatter.format(utcNoon(isoDate));

const shortDayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-09-28" → "Mon 28" (narrow screens) */
export const formatShortDayLabel = (isoDate: string) => shortDayFormatter.format(utcNoon(isoDate));

/** "2026-09-28" → "Monday, Sep 28" */
export const formatDayLabel = (isoDate: string) => longWeekdayFormatter.format(utcNoon(isoDate));

/** ("2026-09-28", "2026-10-04") → "Sep 28 – Oct 4" */
export function formatWeekRange(startDate: string, endDate: string): string {
  return shortDateFormatter.formatRange(utcNoon(startDate), utcNoon(endDate));
}
