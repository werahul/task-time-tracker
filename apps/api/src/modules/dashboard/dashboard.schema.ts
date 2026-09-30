import { z } from "zod";
import { isValidTimeZone } from "../../utils/timezone";

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(isRealCalendarDate, "Date is not a real calendar date");

const timezone = z
  .string()
  .refine(isValidTimeZone, "Timezone must be an IANA name, e.g. Europe/London");

export const dailySummaryQuerySchema = z.object({
  /** Calendar day in `timezone`; defaults to today there. */
  date: isoDate.optional(),
  /** IANA zone defining the day's boundaries; defaults to APP_TIMEZONE. */
  timezone: timezone.optional(),
});

export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;

export const weeklySummaryQuerySchema = z.object({
  /**
   * Any calendar day in `timezone`; the summary covers the Monday → Sunday
   * week containing it (a Monday is the canonical value). Defaults to this week.
   */
  startDate: isoDate.optional(),
  /** IANA zone defining the days' boundaries; defaults to APP_TIMEZONE. */
  timezone: timezone.optional(),
});

export type WeeklySummaryQuery = z.infer<typeof weeklySummaryQuerySchema>;
