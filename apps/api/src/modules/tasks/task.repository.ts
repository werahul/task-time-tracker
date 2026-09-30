import type { Prisma } from "@prisma/client";
import { isPrismaError, prisma, type DbClient } from "../../lib/prisma";
import type { NewTaskData, TaskChanges, TaskListOptions, TaskRecord } from "./task.types";

// userId is deliberately never selected: the owner is always the caller.
const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

/**
 * Every method is scoped by the owner's userId inside the database query itself,
 * so a task id alone can never reach another user's row.
 */
export const taskRepository = {
  createTask(userId: string, data: NewTaskData): Promise<TaskRecord> {
    return prisma.task.create({ data: { ...data, userId }, select: taskSelect });
  },

  findTasksByUser(userId: string, { status, skip, take }: TaskListOptions): Promise<TaskRecord[]> {
    return prisma.task.findMany({
      where: { userId, status },
      // id breaks ties so pages stay stable when timestamps collide.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: taskSelect,
    });
  },

  countTasksByUser(userId: string, status?: TaskListOptions["status"]): Promise<number> {
    return prisma.task.count({ where: { userId, status } });
  },

  findTaskByIdForUser(userId: string, taskId: string): Promise<TaskRecord | null> {
    return prisma.task.findFirst({ where: { id: taskId, userId }, select: taskSelect });
  },

  /** Returns null when no task with this id belongs to the user. */
  async updateTaskForUser(
    userId: string,
    taskId: string,
    changes: TaskChanges,
    db: DbClient = prisma,
  ): Promise<TaskRecord | null> {
    try {
      return await db.task.update({
        where: { id: taskId, userId },
        data: changes,
        select: taskSelect,
      });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return null;
      throw error;
    }
  },

  /** PENDING → IN_PROGRESS when work starts; leaves any other status untouched. */
  async markInProgressIfPending(userId: string, taskId: string, db: DbClient = prisma) {
    await db.task.updateMany({
      where: { id: taskId, userId, status: "PENDING" },
      data: { status: "IN_PROGRESS" },
    });
  },

  /** Returns false when no task with this id belongs to the user. Time logs cascade. */
  async deleteTaskForUser(userId: string, taskId: string): Promise<boolean> {
    const { count } = await prisma.task.deleteMany({ where: { id: taskId, userId } });
    return count === 1;
  },
};
