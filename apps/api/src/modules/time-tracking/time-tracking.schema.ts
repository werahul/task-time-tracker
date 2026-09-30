import { z } from "zod";
import { paginationQuerySchema } from "@task-time-tracker/shared";

/** ISO-8601 with an explicit offset (e.g. 2026-09-29T00:00:00.000Z), parsed to a Date. */
const isoDateTime = z
  .string()
  .datetime({ offset: true, message: "Must be an ISO-8601 date-time with a timezone" })
  .transform((value) => new Date(value));

/** The query's fields (also used by the OpenAPI document). */
export const listTimeLogsQueryFields = paginationQuerySchema.extend({
  taskId: z.string().uuid("Must be a valid task id").optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});

export const listTimeLogsQuerySchema = listTimeLogsQueryFields.refine(
  ({ from, to }) => !from || !to || from < to,
  {
    message: "`from` must be before `to`",
    path: ["from"],
  },
);

/**
 * Timer start/stop take no input: the server decides the timestamps and the
 * duration. Any body field (startedAt, durationSeconds, userId, ...) is rejected.
 */
export const emptyBodySchema = z.object({}).strict().optional();

export type ListTimeLogsQuery = z.infer<typeof listTimeLogsQuerySchema>;
