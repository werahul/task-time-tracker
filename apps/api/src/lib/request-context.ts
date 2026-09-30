import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
}

/**
 * Carries per-request data through async calls without threading it through
 * every function, so any log line or error response can include the requestId.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
