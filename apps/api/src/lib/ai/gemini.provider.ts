import { AIError, type AIProvider } from "./ai.types";
import { TASK_SUGGESTION_SYSTEM_PROMPT, wrapTaskInput } from "./task-suggestion.prompt";

/**
 * Google Gemini adapter, using the Generative Language REST API directly
 * (Node's built-in fetch, no SDK). Gemini has a free tier: a key from Google
 * AI Studio works without billing, within its rate limits.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini's structured-output schema (OpenAPI subset). Zod re-validates the result. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
  },
  required: ["title", "description"],
} as const;

/** Finish reasons meaning the model (or its safety filters) declined the content. */
const REFUSAL_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * An HTTP error from the Gemini API. Only the status and an enum-like reason
 * code (e.g. API_KEY_INVALID, PERMISSION_DENIED) are kept: error messages can
 * echo request content, codes can't.
 */
export class GeminiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason?: string,
  ) {
    super(`Gemini API responded ${status}${reason ? ` (${reason})` : ""}`);
    this.name = "GeminiHttpError";
  }
}

const REASON_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/** Extracts the machine-readable reason from an error body, if it looks like a code. */
async function readErrorReason(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      error?: { status?: unknown; details?: { reason?: unknown }[] };
    };
    const candidates = [
      ...(body.error?.details ?? []).map((detail) => detail.reason),
      body.error?.status,
    ];
    return candidates.find((c): c is string => typeof c === "string" && REASON_CODE.test(c));
  } catch {
    return undefined;
  }
}

/** Maps fetch/HTTP failures to provider-neutral categories. */
export function classifyGeminiError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AIError("AI_REQUEST_TIMEOUT", { cause: error }); // aborted by our deadline
  }
  if (error instanceof GeminiHttpError) {
    if (error.status === 429) return new AIError("AI_RATE_LIMITED", { cause: error }); // free-tier quota
    // 400 bad request/invalid key, 401/403 key or project not allowed, 404 unknown model.
    if ([400, 401, 403, 404].includes(error.status)) {
      return new AIError("AI_CONFIGURATION_ERROR", { cause: error });
    }
  }
  // Network failures, 5xx, 503 overloaded, anything unexpected.
  return new AIError("AI_PROVIDER_UNAVAILABLE", { cause: error });
}

/** Extracts the structured JSON from a generateContent response, or throws a categorized error. */
export function parseGeminiResponse(response: GeminiResponse): unknown {
  if (response.promptFeedback?.blockReason) throw new AIError("AI_REFUSED");

  const [candidate] = response.candidates ?? [];
  if (!candidate) throw new AIError("AI_INVALID_RESPONSE");
  if (candidate.finishReason && REFUSAL_FINISH_REASONS.has(candidate.finishReason)) {
    throw new AIError("AI_REFUSED");
  }
  if (candidate.finishReason === "MAX_TOKENS") throw new AIError("AI_INVALID_RESPONSE");

  // Skip any "thought" parts; the answer is the remaining text.
  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (!text) throw new AIError("AI_INVALID_RESPONSE");

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AIError("AI_INVALID_RESPONSE", { cause: error });
  }
}

export function createGeminiProvider(options: {
  apiKey: string;
  model: string;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}): AIProvider {
  const doFetch = options.fetch ?? fetch;

  return {
    name: "gemini",
    model: options.model,
    async generateTaskSuggestion(input, signal) {
      try {
        const response = await doFetch(
          `${API_BASE}/${encodeURIComponent(options.model)}:generateContent`,
          {
            method: "POST",
            // The key goes in a header, never the URL, so it can't leak into logs.
            headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: TASK_SUGGESTION_SYSTEM_PROMPT }] },
              // Only the user's note is sent — no account, task, or session data.
              contents: [{ role: "user", parts: [{ text: wrapTaskInput(input) }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
                maxOutputTokens: 4096,
                temperature: 0.4,
              },
            }),
            signal,
          },
        );
        if (!response.ok) {
          throw new GeminiHttpError(response.status, await readErrorReason(response));
        }
        return parseGeminiResponse((await response.json()) as GeminiResponse);
      } catch (error) {
        throw classifyGeminiError(error);
      }
    },
  };
}
