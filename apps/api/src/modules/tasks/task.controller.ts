import type { Request, Response } from "express";
import {
  listTasksQuerySchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@task-time-tracker/shared";
import { getAuthenticatedUser } from "../../middleware/authenticate.middleware";
import { parseOrThrow } from "../../middleware/validate.middleware";
import { sendSuccess } from "../../utils/api-response";
import { taskService } from "./task.service";

// Request bodies were parsed by `validateBody` in the routes. The owner is
// always the authenticated user — nothing in the request can choose it.
export const taskController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(listTasksQuerySchema, req.query);
    const result = await taskService.listTasks(getAuthenticatedUser(req).id, query);
    sendSuccess(res, result);
  },

  async create(req: Request, res: Response): Promise<void> {
    const task = await taskService.createTask(
      getAuthenticatedUser(req).id,
      req.body as CreateTaskInput,
    );
    sendSuccess(res, { task }, 201);
  },

  async get(req: Request<{ id: string }>, res: Response): Promise<void> {
    const task = await taskService.getTask(getAuthenticatedUser(req).id, req.params.id);
    sendSuccess(res, { task });
  },

  async update(req: Request<{ id: string }>, res: Response): Promise<void> {
    const task = await taskService.updateTask(
      getAuthenticatedUser(req).id,
      req.params.id,
      req.body as UpdateTaskInput,
    );
    sendSuccess(res, { task });
  },

  async remove(req: Request<{ id: string }>, res: Response): Promise<void> {
    await taskService.deleteTask(getAuthenticatedUser(req).id, req.params.id);
    res.status(204).end();
  },
};
