import type { TaskSuggestion } from "@task-time-tracker/shared";
import { api } from "@/lib/api/client";

export const taskAiApi = {
  /** Returns a suggestion only; nothing is created until the user submits the form. */
  suggest: (input: string) => api.post<TaskSuggestion>("/tasks/suggest", { input }),
};
