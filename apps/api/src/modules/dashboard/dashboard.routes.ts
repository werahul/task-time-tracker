import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.middleware";
import { dashboardController } from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get("/daily-summary", dashboardController.dailySummary);
dashboardRouter.get("/weekly-summary", dashboardController.weeklySummary);
