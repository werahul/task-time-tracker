import { ApiRequestError } from "./client";

/**
 * The one place that turns any failure into text for users.
 *
 * 4xx messages from our API are written for users (validation, conflicts,
 * not found), so they're shown as-is. 5xx, network, and unknown errors get
 * generic copy — raw server or runtime text is never displayed — plus a
 * short reference id for support.
 */
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return "Something went wrong. Please try again.";
  }

  switch (error.status) {
    case 0:
      return "Can't reach the server. Check your connection and try again.";
    case 401:
      return error.code === "INVALID_CREDENTIALS"
        ? error.message
        : "Your session has ended. Please sign in again.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
    case 409:
    case 422:
      return error.message;
    case 429:
      // Our own AI/provider limits carry specific copy; the generic limiter doesn't.
      return error.code.startsWith("AI_")
        ? error.message
        : "You're doing that too often. Please wait a moment and try again.";
    default:
      if (error.status >= 500) {
        // AI failures are controlled and already user-facing.
        if (error.code.startsWith("AI_")) return error.message;
        const reference = error.requestId ? ` (reference ${error.requestId.slice(0, 8)})` : "";
        return error.status === 503
          ? `The service is temporarily unavailable. Please try again shortly${reference}.`
          : `Something went wrong on our side. Please try again${reference}.`;
      }
      return "Something went wrong. Please try again.";
  }
}

const SESSION_LOST_CODES = new Set([
  // These three only surface after a silent refresh already failed.
  "AUTHENTICATION_REQUIRED",
  "INVALID_ACCESS_TOKEN",
  "ACCESS_TOKEN_EXPIRED",
  "INVALID_REFRESH_TOKEN",
  "SESSION_EXPIRED",
]);

/** True when the user must sign in again (not e.g. a wrong password on the login form). */
export function isSessionLost(error: unknown): boolean {
  return (
    error instanceof ApiRequestError && error.status === 401 && SESSION_LOST_CODES.has(error.code)
  );
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}
