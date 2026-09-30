import { Router } from "express";
import { env } from "../../../config/env";
import { authenticate, getAuthenticatedUser } from "../../../middleware/authenticate.middleware";
import { createRateLimiter } from "../../../middleware/rate-limit.middleware";
import { validateBody } from "../../../middleware/validate.middleware";
import { aiTaskController } from "./ai-task.controller";
import { suggestTaskBodySchema } from "./ai-task.schema";

// Stricter than CRUD and keyed by user, so one account can't drain the AI
// budget from many IPs. Runs before validation: malformed requests count too.
const suggestLimiter = createRateLimiter({
  name: "ai.suggest",
  windowMs: env.AI_RATE_LIMIT_WINDOW * 1000,
  limit: env.AI_RATE_LIMIT_MAX,
  keyGenerator: (req) => `user:${getAuthenticatedUser(req).id}`,
});

/** Mounted at /tasks. Suggestion only — creating a task stays POST /tasks. */
export const aiTaskRouter = Router();

aiTaskRouter.post(
  "/suggest",
  authenticate,
  suggestLimiter,
  validateBody(suggestTaskBodySchema),
  aiTaskController.suggest,
);
