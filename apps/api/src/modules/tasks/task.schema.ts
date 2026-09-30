import { z } from "zod";
import { validateParams } from "../../middleware/validate.middleware";
import { TaskErrors } from "./task.errors";

// Request body/query schemas are shared with the frontend (@task-time-tracker/shared).
// This file holds the API-only rules.

/** Task ids are UUIDs; anything else cannot identify a task. */
export const taskIdSchema = z.string().uuid();

/**
 * Route guard for a task-id param. A malformed id gets the same 404 as a
 * missing or foreign task, so the response never distinguishes the three.
 */
export function requireTaskIdParam(param: "id" | "taskId") {
  return validateParams(z.object({ [param]: taskIdSchema }), TaskErrors.notFound);
}
