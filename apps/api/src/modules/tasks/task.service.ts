import {
  canTransitionTaskStatus,
  type CreateTaskInput,
  type ListTasksQuery,
  type Paginated,
  type UpdateTaskInput,
} from "@task-time-tracker/shared";
import { runInTransaction } from "../../lib/prisma";
import { timeTrackingRepository } from "../time-tracking/time-tracking.repository";
import { TaskErrors } from "./task.errors";
import { taskRepository } from "./task.repository";
import type { TaskChanges, TaskRecord } from "./task.types";

// Task ids reaching the service were already validated as UUIDs by the routes.
async function getTask(userId: string, taskId: string): Promise<TaskRecord> {
  const task = await taskRepository.findTaskByIdForUser(userId, taskId);
  if (!task) throw TaskErrors.notFound();
  return task;
}

/** `userId` always comes from the authenticated session, never from request input. */
export const taskService = {
  createTask(userId: string, input: CreateTaskInput): Promise<TaskRecord> {
    return taskRepository.createTask(userId, {
      title: input.title,
      description: input.description ?? null,
    });
  },

  async listTasks(userId: string, query: ListTasksQuery): Promise<Paginated<TaskRecord>> {
    const { status, page, limit } = query;
    const [items, total] = await Promise.all([
      taskRepository.findTasksByUser(userId, { status, skip: (page - 1) * limit, take: limit }),
      taskRepository.countTasksByUser(userId, status),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  getTask,

  async updateTask(userId: string, taskId: string, input: UpdateTaskInput): Promise<TaskRecord> {
    const current = await getTask(userId, taskId);

    if (input.status && !canTransitionTaskStatus(current.status, input.status)) {
      throw TaskErrors.invalidStatusTransition(current.status, input.status);
    }

    const changes: TaskChanges = { ...input };
    const completing = input.status === "COMPLETED" && current.status !== "COMPLETED";
    if (input.status && input.status !== current.status) {
      // Completion time is recorded by the server, never taken from the client.
      changes.completedAt = completing ? new Date() : null;
    }

    const updated = await runInTransaction(async (db) => {
      const task = await taskRepository.updateTaskForUser(userId, taskId, changes, db);
      // Completed tasks can't be timed, so completing one stops its running
      // timer at the completion instant, atomically with the status change.
      if (task && completing && changes.completedAt) {
        await timeTrackingRepository.stopActiveTimerForTask(
          userId,
          taskId,
          changes.completedAt,
          db,
        );
      }
      return task;
    });
    // Deleted between the read and the write.
    if (!updated) throw TaskErrors.notFound();
    return updated;
  },

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const deleted = await taskRepository.deleteTaskForUser(userId, taskId);
    if (!deleted) throw TaskErrors.notFound();
  },
};
