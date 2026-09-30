import type { ApiFieldErrors, ApiResponse } from "@task-time-tracker/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
const REFRESH_PATH = "/auth/refresh";

/**
 * A failed API call. `message` is the server's text as-is — show users
 * `getErrorMessage(error)` (lib/api/errors) instead, which decides what's safe.
 */
export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiFieldErrors,
    /** Matches the server's logs; worth quoting in a support request. */
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function send<T>(
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: ApiResponse<T>; requestId?: string }> {
  let response: Response;
  try {
    // Auth lives in HttpOnly cookies; the browser attaches them. JS never reads tokens.
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiRequestError("NETWORK_ERROR", "Unable to reach the server", 0);
  }

  const requestId = response.headers.get("X-Request-ID") ?? undefined;

  if (response.status === 204) {
    return { status: 204, body: { success: true, data: undefined as T }, requestId };
  }

  try {
    return { status: response.status, body: (await response.json()) as ApiResponse<T>, requestId };
  } catch {
    // e.g. an HTML error page from a proxy in front of the API.
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Unexpected response from the server",
      response.status,
      undefined,
      requestId,
    );
  }
}

/**
 * 401s a refresh can fix. The access cookie's Max-Age matches the token's
 * lifetime, so once it expires the browser stops sending it: the API then sees
 * no token at all (AUTHENTICATION_REQUIRED), not an expired one. Both mean
 * "try the refresh cookie"; if that fails too, the session is really over.
 */
const REFRESHABLE_CODES = new Set([
  "ACCESS_TOKEN_EXPIRED",
  "AUTHENTICATION_REQUIRED",
  "INVALID_ACCESS_TOKEN",
]);

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the session once, sharing the result between concurrent callers. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= send<unknown>(REFRESH_PATH, { method: "POST" })
    .then(({ body }) => body.success)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit, allowRefresh = true): Promise<T> {
  const { status, body, requestId } = await send<T>(path, init);

  if (body.success) return body.data;

  if (
    allowRefresh &&
    REFRESHABLE_CODES.has(body.error.code) &&
    path !== REFRESH_PATH &&
    (await refreshSession())
  ) {
    return request<T>(path, init, false);
  }

  throw new ApiRequestError(
    body.error.code,
    body.error.message,
    status,
    body.error.details,
    body.error.requestId ?? requestId,
  );
}

function withJsonBody(method: string, data: unknown): RequestInit {
  return data === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, withJsonBody("POST", data)),
  patch: <T>(path: string, data?: unknown) => request<T>(path, withJsonBody("PATCH", data)),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
