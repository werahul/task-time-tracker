import type { TaskSuggestion } from "@task-time-tracker/shared";
import { aiService } from "../../../lib/ai/ai.service";
import { AIError, type AIErrorCategory } from "../../../lib/ai/ai.types";
import { AppError } from "../../../lib/app-error";

// Safe, provider-neutral messages. Provider errors, prompts, and keys never reach clients.
const AI_ERROR_RESPONSES: Record<AIErrorCategory, { status: number; message: string }> = {
  AI_CONFIGURATION_ERROR: { status: 503, message: "AI suggestions are not available right now." },
  AI_PROVIDER_UNAVAILABLE: {
    status: 502,
    message: "The AI service is temporarily unavailable. Please try again.",
  },
  AI_REQUEST_TIMEOUT: {
    status: 504,
    message: "The AI service took too long to respond. Please try again.",
  },
  AI_RATE_LIMITED: {
    status: 429,
    message: "The AI service is busy right now. Please try again in a moment.",
  },
  AI_INVALID_RESPONSE: {
    status: 502,
    message: "The AI couldn't produce a usable suggestion. Please try again.",
  },
  AI_REFUSED: {
    status: 422,
    message: "The assistant couldn't turn this into a task. Try rephrasing it.",
  },
};

/**
 * Produces a *suggestion* only. It never creates, reads, or changes tasks and
 * receives nothing but the user's text; the user reviews the result and
 * creates the task through the normal POST /tasks endpoint.
 */
export const aiTaskService = {
  async suggestTask(input: string): Promise<TaskSuggestion> {
    try {
      return await aiService.generateTaskSuggestion(input);
    } catch (error) {
      if (error instanceof AIError) {
        const { status, message } = AI_ERROR_RESPONSES[error.category];
        throw new AppError(status, error.category, message);
      }
      throw error;
    }
  },
};
