import type { Request, Response } from "express";
import { sendSuccess } from "../../../utils/api-response";
import { aiTaskService } from "./ai-task.service";
import type { SuggestTaskInput } from "./ai-task.types";

export const aiTaskController = {
  // Body parsed by `validateBody`. Only the text is forwarded — not the user id,
  // cookies, or any stored data.
  async suggest(req: Request, res: Response): Promise<void> {
    const { input } = req.body as SuggestTaskInput;
    sendSuccess(res, await aiTaskService.suggestTask(input));
  },
};
