import type { Request, Response } from "express";
import { paginationQuerySchema } from "@task-time-tracker/shared";
import { getAuthenticatedUser } from "../../middleware/authenticate.middleware";
import { parseOrThrow } from "../../middleware/validate.middleware";
import { sendSuccess } from "../../utils/api-response";
import { listTimeLogsQuerySchema } from "./time-tracking.schema";
import { timeTrackingService } from "./time-tracking.service";

type TaskParams = { taskId: string };

export const timeTrackingController = {
  async start(req: Request<TaskParams>, res: Response): Promise<void> {
    const timer = await timeTrackingService.startTimer(
      getAuthenticatedUser(req).id,
      req.params.taskId,
    );
    sendSuccess(res, timer, 201);
  },

  async stop(req: Request<TaskParams>, res: Response): Promise<void> {
    const timeLog = await timeTrackingService.stopTimer(
      getAuthenticatedUser(req).id,
      req.params.taskId,
    );
    sendSuccess(res, timeLog);
  },

  async listForTask(req: Request<TaskParams>, res: Response): Promise<void> {
    const query = parseOrThrow(paginationQuerySchema, req.query);
    const result = await timeTrackingService.listTaskTimeLogs(
      getAuthenticatedUser(req).id,
      req.params.taskId,
      query,
    );
    sendSuccess(res, result);
  },

  async active(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await timeTrackingService.getActiveTimer(getAuthenticatedUser(req).id));
  },

  async list(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(listTimeLogsQuerySchema, req.query);
    sendSuccess(res, await timeTrackingService.listTimeLogs(getAuthenticatedUser(req).id, query));
  },
};
