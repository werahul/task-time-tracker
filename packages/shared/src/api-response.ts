/**
 * Shared API response contract used by both the Express API and the Next.js
 * frontend so that success/error shapes never drift between the two sides.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiFieldErrors = Record<string, string[]>;

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiFieldErrors;
    /** Correlates the response with server logs; also sent as the X-Request-ID header. */
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
