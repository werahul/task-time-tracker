import type { TaskStatus } from "@task-time-tracker/shared";

/** A task as returned by the repository. Serialized to the shared `Task` wire type. */
export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTaskData {
  title: string;
  description: string | null;
}

export interface TaskChanges {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  completedAt?: Date | null;
}

export interface TaskListOptions {
  status?: TaskStatus;
  skip: number;
  take: number;
}
