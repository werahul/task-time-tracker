"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDuration, type ActiveTimer } from "@task-time-tracker/shared";
import { toast } from "sonner";
import { dashboardKeys } from "@/features/dashboard/query-keys";
import { taskKeys } from "@/features/tasks/hooks/use-tasks";
import { ApiRequestError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { timeTrackingApi } from "../api/time-tracking.api";
import { timeTrackingKeys } from "../query-keys";
import type { ActiveTimerState } from "../types/time-tracking.types";

function anchor(timer: ActiveTimer): ActiveTimerState {
  return { ...timer, anchorMs: Date.now() - timer.elapsedMs };
}

/**
 * The server's view of the running timer — the only copy on the client.
 * Refetched on focus/reconnect and periodically, so a timer stopped in another
 * tab or device is reflected without a WebSocket.
 */
export function useActiveTimer() {
  return useQuery({
    queryKey: timeTrackingKeys.active,
    queryFn: async (): Promise<ActiveTimerState | null> => {
      const timer = await timeTrackingApi.active();
      return timer ? anchor(timer) : null;
    },
    refetchInterval: 60_000,
    staleTime: 0,
  });
}

function useSyncAfterTimerChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: timeTrackingKeys.all }),
      // Starting moves a PENDING task to IN_PROGRESS.
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const sync = useSyncAfterTimerChange();
  return useMutation({
    mutationFn: (taskId: string) => timeTrackingApi.start(taskId),
    onSuccess: (timer) => {
      queryClient.setQueryData(timeTrackingKeys.active, anchor(timer));
      toast.success("Timer started.");
    },
    // On success or conflict alike, re-read the server's state.
    onSettled: sync,
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const sync = useSyncAfterTimerChange();
  return useMutation({
    mutationFn: (taskId: string) => timeTrackingApi.stop(taskId),
    onSuccess: (log) => {
      queryClient.setQueryData(timeTrackingKeys.active, null);
      toast.success(`Timer stopped · ${formatDuration(log.durationSeconds)} logged.`);
    },
    onSettled: sync,
  });
}

/** User-facing copy for timer errors, per the API's error codes. */
export function timerErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "ACTIVE_TIMER_EXISTS":
        return "You already have a timer running on another task.";
      case "ACTIVE_TIMER_NOT_FOUND":
      case "TIMER_ALREADY_STOPPED":
        return "This timer was already stopped.";
    }
  }
  return getErrorMessage(error);
}
