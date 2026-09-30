import { taskSuggestionSchema, type TaskSuggestion } from "@task-time-tracker/shared";
import { env } from "../../config/env";
import { logger } from "../logger";
import { aiProvider } from "./ai.provider";
import { AIError, type AIProvider } from "./ai.types";

interface AIServiceOptions {
  provider: AIProvider | null;
  timeoutMs: number;
}

/**
 * Wraps a provider with the guarantees the app relies on: a hard deadline,
 * schema validation of the output, categorized errors, and logging that never
 * includes the user's text, prompts, or credentials.
 */
export function createAIService({ provider, timeoutMs }: AIServiceOptions) {
  return {
    async generateTaskSuggestion(input: string): Promise<TaskSuggestion> {
      if (!provider) throw new AIError("AI_CONFIGURATION_ERROR");

      const startedAt = Date.now();
      const logFields = () => ({
        event: "ai.task_suggestion",
        provider: provider.name,
        model: provider.model,
        durationMs: Date.now() - startedAt,
      });
      const controller = new AbortController();
      let deadline: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => {
          controller.abort(); // cancel the in-flight provider request
          reject(new AIError("AI_REQUEST_TIMEOUT"));
        }, timeoutMs);
      });

      try {
        const raw = await Promise.race([
          provider.generateTaskSuggestion(input, controller.signal),
          timeout,
        ]);
        const parsed = taskSuggestionSchema.safeParse(raw);
        if (!parsed.success) throw new AIError("AI_INVALID_RESPONSE");

        logger.info(
          { ...logFields(), outcome: "success", inputChars: input.length },
          "AI suggestion completed",
        );
        return parsed.data;
      } catch (error) {
        const aiError =
          error instanceof AIError
            ? error
            : new AIError("AI_PROVIDER_UNAVAILABLE", { cause: error });
        // Category plus the provider's HTTP status / reason code when known —
        // never provider messages, which can echo request details.
        const cause = aiError.cause as { status?: unknown; reason?: unknown } | undefined;
        logger.warn(
          {
            ...logFields(),
            outcome: "failure",
            category: aiError.category,
            providerStatus: typeof cause?.status === "number" ? cause.status : undefined,
            providerReason: typeof cause?.reason === "string" ? cause.reason : undefined,
          },
          "AI suggestion failed",
        );
        throw aiError;
      } finally {
        clearTimeout(deadline);
      }
    },
  };
}

export const aiService = createAIService({ provider: aiProvider, timeoutMs: env.AI_TIMEOUT_MS });
