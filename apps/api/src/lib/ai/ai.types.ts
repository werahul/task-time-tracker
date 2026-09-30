/** Provider-neutral failure categories. Callers map these to HTTP responses. */
export type AIErrorCategory =
  | "AI_CONFIGURATION_ERROR" // not configured, bad key/model, or a request we built wrong
  | "AI_PROVIDER_UNAVAILABLE" // provider down, overloaded, or unreachable
  | "AI_REQUEST_TIMEOUT"
  | "AI_RATE_LIMITED" // the provider throttled us
  | "AI_INVALID_RESPONSE" // output missing, malformed, or failing our schema
  | "AI_REFUSED"; // the model declined the input

export class AIError extends Error {
  constructor(
    public readonly category: AIErrorCategory,
    options?: { cause?: unknown },
  ) {
    super(category, options);
    this.name = "AIError";
  }
}

/**
 * An AI backend. Implementations own their SDK, prompt transport, and error
 * classification; nothing outside `lib/ai` knows which provider is in use.
 *
 * Output is `unknown` on purpose: whatever a model returns is untrusted until
 * the AI service validates it against the suggestion schema.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateTaskSuggestion(input: string, signal: AbortSignal): Promise<unknown>;
}
