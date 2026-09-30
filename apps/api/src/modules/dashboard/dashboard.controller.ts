import type { Request, Response } from "express";
import { getAuthenticatedUser } from "../../middleware/authenticate.middleware";
import { parseOrThrow } from "../../middleware/validate.middleware";
import { sendSuccess } from "../../utils/api-response";
import { dailySummaryQuerySchema, weeklySummaryQuerySchema } from "./dashboard.schema";
import { dashboardService } from "./dashboard.service";

export const dashboardController = {
  async dailySummary(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(dailySummaryQuerySchema, req.query);
    const summary = await dashboardService.getDailySummary(getAuthenticatedUser(req).id, query);
    sendSuccess(res, summary);
  },

  async weeklySummary(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(weeklySummaryQuerySchema, req.query);
    const summary = await dashboardService.getWeeklySummary(getAuthenticatedUser(req).id, query);
    sendSuccess(res, summary);
  },
};
