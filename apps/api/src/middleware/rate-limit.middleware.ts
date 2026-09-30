import { rateLimit, type Options } from "express-rate-limit";
import { logger } from "../lib/logger";
import { sendError } from "../utils/api-response";

interface RateLimiterOptions {
  /** Identifies the limiter in logs, e.g. "auth.login". */
  name: string;
  windowMs: number;
  limit: number;
  skip?: Options["skip"];
  /** Defaults to the client IP; pass one to limit per user instead. */
  keyGenerator?: Options["keyGenerator"];
}

/** Rate limiter that logs when it trips and responds with the standard error envelope. */
export function createRateLimiter({
  name,
  windowMs,
  limit,
  skip,
  keyGenerator,
}: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    skip,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(
        { event: "rate_limit.exceeded", limiter: name, method: req.method, path: req.path },
        "Rate limit exceeded",
      );
      sendError(res, 429, "TOO_MANY_REQUESTS", "Too many requests, please try again later");
    },
  });
}
