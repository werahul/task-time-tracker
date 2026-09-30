"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput, UpdateTaskInput } from "@task-time-tracker/shared";
import { dashboardKeys } from "@/features/dashboard/query-keys";
import { timeTrackingKeys } from "@/features/time-tracking/query-keys";
import { toast } from "sonner";
import { ApiRequestError } from "@/lib/api/client";
import { tasksApi, type TaskListParams } from "../api/tasks.api";
import { TASK_STATUS_LABELS } from "../task-status";

export const taskKeys = {
  all: ["tasks"] as const,
  list: (params: TaskListParams) => ["tasks", "list", params] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
};

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => (await tasksApi.get(id)).task,
    // A 404 (missing or someone else's task) won't change on retry.
    retry: (failureCount, error) =>
      !(error instanceof ApiRequestError && error.status === 404) && failureCount < 1,
  });
}

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksApi.list(params),
    // Keep the current page on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
  });
}

// Every mutation invalidates all task queries and the dashboard summary so the
// UI always reflects the server without keeping a second copy of task state.
// Timer state too: completing or deleting a task stops its running timer.
function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({ queryKey: timeTrackingKeys.all }),
    ]);
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: () => {
      toast.success("Task created.");
      return invalidate();
    },
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      tasksApi.update(id, input),
    onSuccess: (_task, { input }) => {
      // A status-only change (task menu) vs an edit of the task's details.
      const { status, ...details } = input;
      toast.success(
        status && Object.keys(details).length === 0
          ? `Task moved to ${TASK_STATUS_LABELS[status]}.`
          : "Task updated.",
      );
      return invalidate();
    },
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    // Deleting a task cascades its time logs — including a running timer.
    onSuccess: () => {
      toast.success("Task deleted.");
      return invalidate();
    },
  });
}
