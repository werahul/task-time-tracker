import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { requireTaskIdParam } from "../tasks/task.schema";
import { timeTrackingController } from "./time-tracking.controller";
import { emptyBodySchema } from "./time-tracking.schema";

const taskId = requireTaskIdParam("taskId");

/** Mounted at /tasks/:taskId — timer control and per-task logs. */
export const taskTimerRouter = Router({ mergeParams: true });
taskTimerRouter.use(authenticate);
taskTimerRouter.post(
  "/timer/start",
  taskId,
  validateBody(emptyBodySchema),
  timeTrackingController.start,
);
taskTimerRouter.post(
  "/timer/stop",
  taskId,
  validateBody(emptyBodySchema),
  timeTrackingController.stop,
);
taskTimerRouter.get("/time-logs", taskId, timeTrackingController.listForTask);

/** Mounted at /time-logs — the user's sessions across all tasks. */
export const timeLogRouter = Router();
timeLogRouter.use(authenticate);
timeLogRouter.get("/active", timeTrackingController.active);
timeLogRouter.get("/", timeTrackingController.list);
