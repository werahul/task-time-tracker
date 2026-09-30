import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { AIError, type AIProvider } from "./ai.types";
import {
  TASK_SUGGESTION_JSON_SCHEMA,
  TASK_SUGGESTION_SYSTEM_PROMPT,
  wrapTaskInput,
} from "./task-suggestion.prompt";

/** Maps SDK errors to provider-neutral categories (most specific class first). */
export function classifyAnthropicError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Anthropic.APIUserAbortError) {
    return new AIError("AI_REQUEST_TIMEOUT", { cause: error }); // aborted by our deadline
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIError("AI_REQUEST_TIMEOUT", { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIError("AI_RATE_LIMITED", { cause: error });
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError || // unknown model id
    error instanceof Anthropic.BadRequestError // a request we built is invalid
  ) {
    return new AIError("AI_CONFIGURATION_ERROR", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AIError("AI_PROVIDER_UNAVAILABLE", { cause: error });
  }
  if (error instanceof Anthropic.APIError && error.status === 402) {
    return new AIError("AI_CONFIGURATION_ERROR", { cause: error }); // billing
  }
  // 5xx, 529 overloaded, and anything unexpected.
  return new AIError("AI_PROVIDER_UNAVAILABLE", { cause: error });
}

/** Extracts the structured JSON from a response, or throws a categorized error. */
export function parseTaskSuggestionMessage(message: Anthropic.Beta.BetaMessage): unknown {
  if (message.stop_reason === "refusal") throw new AIError("AI_REFUSED");
  if (message.stop_reason === "max_tokens") throw new AIError("AI_INVALID_RESPONSE");

  const text = message.content.find(
    (block): block is Anthropic.Beta.BetaTextBlock => block.type === "text",
  );
  if (!text) throw new AIError("AI_INVALID_RESPONSE");

  try {
    return JSON.parse(text.text) as unknown;
  } catch (error) {
    throw new AIError("AI_INVALID_RESPONSE", { cause: error });
  }
}

export function createAnthropicProvider(options: { apiKey: string; model: string }): AIProvider {
  // Our own deadline (AbortSignal) bounds the whole call, SDK retries included.
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 1 });

  return {
    name: "anthropic",
    model: options.model,
    async generateTaskSuggestion(input, signal) {
      try {
        const message = await client.beta.messages.create(
          {
            model: options.model,
            max_tokens: 4096,
            system: TASK_SUGGESTION_SYSTEM_PROMPT,
            // Only the user's note is sent — no account, task, or session data.
            messages: [{ role: "user", content: wrapTaskInput(input) }],
            output_config: {
              effort: "low", // a short rewrite; keeps latency and cost down
              format: { type: "json_schema", schema: TASK_SUGGESTION_JSON_SCHEMA },
            },
            // If the model declines, the API retries on a fallback model in-call.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { signal },
        );
        return parseTaskSuggestionMessage(message);
      } catch (error) {
        throw classifyAnthropicError(error);
      }
    },
  };
}

/** The configured provider, or null when AI is disabled (AI_PROVIDER unset). */
function createConfiguredProvider(): AIProvider | null {
  if (env.AI_PROVIDER === "anthropic" && env.AI_API_KEY) {
    return createAnthropicProvider({ apiKey: env.AI_API_KEY, model: env.AI_MODEL });
  }
  return null;
}

export const aiProvider = createConfiguredProvider();
