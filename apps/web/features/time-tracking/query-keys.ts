export const timeTrackingKeys = {
  all: ["time-tracking"] as const,
  active: ["time-tracking", "active"] as const,
  logs: (params: object) => ["time-tracking", "logs", params] as const,
  taskLogs: (taskId: string, params: object) =>
    ["time-tracking", "task-logs", taskId, params] as const,
};
