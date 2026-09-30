import type {
  CreateTaskInput,
  Paginated,
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "@task-time-tracker/shared";
import { api } from "@/lib/api/client";

export interface TaskListParams {
  status?: TaskStatus;
  page?: number;
  limit?: number;
}

function toQueryString({ status, page, limit }: TaskListParams): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const tasksApi = {
  list: (params: TaskListParams = {}) => api.get<Paginated<Task>>(`/tasks${toQueryString(params)}`),
  get: (id: string) => api.get<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`),
  create: (input: CreateTaskInput) => api.post<{ task: Task }>("/tasks", input),
  update: (id: string, input: UpdateTaskInput) =>
    api.patch<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, input),
  remove: (id: string) => api.delete<void>(`/tasks/${encodeURIComponent(id)}`),
};
