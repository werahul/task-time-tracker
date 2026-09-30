"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiRequestError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { taskAiApi } from "../api/task-ai.api";

/**
 * A mutation, not a query: a suggestion is throwaway UI state for one form,
 * never cached or shared as server state.
 */
export function useTaskSuggestion() {
  return useMutation({
    mutationFn: (input: string) => taskAiApi.suggest(input),
    onSuccess: () => toast.success("Suggestion ready. Review and edit it before saving."),
  });
}

export function suggestionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "VALIDATION_ERROR") {
      return error.details?.input?.[0] ?? "Check what you entered and try again.";
    }
    if (error.code === "TOO_MANY_REQUESTS") {
      return "You've asked for a lot of suggestions recently. Try again in a few minutes.";
    }
  }
  return getErrorMessage(error);
}
