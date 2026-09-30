import { z } from "zod";
import { TASK_SUGGESTION_INPUT_MIN_LENGTH } from "@task-time-tracker/shared";
import { env } from "../../../config/env";

/** Bounded before anything reaches the provider (cost, latency, provider limits). */
export const suggestTaskBodySchema = z
  .object({
    input: z
      .string({ required_error: "Describe what you need to do" })
      .trim()
      .min(
        TASK_SUGGESTION_INPUT_MIN_LENGTH,
        `Enter at least ${TASK_SUGGESTION_INPUT_MIN_LENGTH} characters`,
      )
      .max(env.AI_MAX_INPUT_LENGTH, `Keep it under ${env.AI_MAX_INPUT_LENGTH} characters`),
  })
  .strict();
