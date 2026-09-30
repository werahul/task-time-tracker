"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { timeTrackingApi, type TimeLogListParams } from "../api/time-tracking.api";
import { timeTrackingKeys } from "../query-keys";

export function useTimeLogs(params: TimeLogListParams) {
  return useQuery({
    queryKey: timeTrackingKeys.logs(params),
    queryFn: () => timeTrackingApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** A task's sessions plus its total tracked seconds (SUM computed by the API). */
export function useTaskTimeLogs(taskId: string, params: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: timeTrackingKeys.taskLogs(taskId, params),
    queryFn: () => timeTrackingApi.listForTask(taskId, params),
    placeholderData: keepPreviousData,
  });
}
