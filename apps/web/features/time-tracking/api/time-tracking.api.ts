import type { ActiveTimer, Paginated, TaskTimeLogs, TimeLog } from "@task-time-tracker/shared";
import { api } from "@/lib/api/client";

export interface TimeLogListParams {
  page?: number;
  limit?: number;
  taskId?: string;
  /** ISO-8601 with timezone; inclusive. */
  from?: string;
  /** ISO-8601 with timezone; exclusive. */
  to?: string;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

const taskPath = (taskId: string) => `/tasks/${encodeURIComponent(taskId)}`;

// Start/stop send no body: the server owns every timestamp and duration.
export const timeTrackingApi = {
  active: () => api.get<ActiveTimer | null>("/time-logs/active"),
  start: (taskId: string) => api.post<ActiveTimer>(`${taskPath(taskId)}/timer/start`),
  stop: (taskId: string) => api.post<TimeLog>(`${taskPath(taskId)}/timer/stop`),
  list: (params: TimeLogListParams = {}) =>
    api.get<Paginated<TimeLog>>(`/time-logs${toQueryString({ ...params })}`),
  listForTask: (taskId: string, params: { page?: number; limit?: number } = {}) =>
    api.get<TaskTimeLogs>(`${taskPath(taskId)}/time-logs${toQueryString(params)}`),
};
