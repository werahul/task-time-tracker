import { Router } from "express";
import { createTaskSchema, updateTaskSchema } from "@task-time-tracker/shared";
import { authenticate } from "../../middleware/authenticate.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { taskController } from "./task.controller";
import { requireTaskIdParam } from "./task.schema";

export const taskRouter = Router();
const taskId = requireTaskIdParam("id");

// Router-level so no task endpoint can be added without authentication.
taskRouter.use(authenticate);

taskRouter.get("/", taskController.list);
taskRouter.post("/", validateBody(createTaskSchema), taskController.create);
taskRouter.get("/:id", taskId, taskController.get);
taskRouter.patch("/:id", taskId, validateBody(updateTaskSchema), taskController.update);
taskRouter.delete("/:id", taskId, taskController.remove);
