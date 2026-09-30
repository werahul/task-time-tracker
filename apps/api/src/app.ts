import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { createRateLimiter } from "./middleware/rate-limit.middleware";
import { REQUEST_ID_HEADER, requestId } from "./middleware/request-id.middleware";
import { requestLogger } from "./middleware/request-logger.middleware";
import { requireTrustedOrigin } from "./middleware/trusted-origin.middleware";
import { limitUrlLength } from "./middleware/url-length.middleware";
import { v1Router } from "./routes/v1.router";

/** JSON bodies are small everywhere (largest: an AI note of ≤ 4000 chars). */
const JSON_BODY_LIMIT = "10kb";

export function createApp(): Application {
  const app = express();

  app.disable("x-powered-by");
  // Hops of reverse proxy to trust for req.ip (rate limiting). 0 = trust none.
  app.set("trust proxy", env.TRUST_PROXY);

  // First, so every log line and error body carries the request id.
  app.use(requestId);
  app.use(requestLogger);

  app.use(
    helmet({
      // A JSON API loads nothing and is never framed: deny everything.
      // (Swagger UI gets a scoped exception in routes/docs.route.ts.)
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "no-referrer" },
      // HSTS only where TLS is guaranteed; on http://localhost it would be meaningless.
      hsts: env.NODE_ENV === "production" ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin: env.FRONTEND_ORIGINS, // exact allow-list; never "*" with credentials
      credentials: true,
      exposedHeaders: [REQUEST_ID_HEADER, "RateLimit", "RateLimit-Policy", "Retry-After"],
      maxAge: 600, // cache preflights for 10 minutes
    }),
  );

  app.use(limitUrlLength);
  // Only JSON is parsed; form-encoded bodies are ignored (and then fail validation).
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));
  app.use(cookieParser());
  app.use(requireTrustedOrigin);

  // Baseline per-IP limit for all API traffic; health probes are exempt.
  app.use(
    "/api/v1",
    createRateLimiter({
      name: "api",
      windowMs: env.API_RATE_LIMIT_WINDOW * 1000,
      limit: env.API_RATE_LIMIT_MAX,
      skip: (req) => env.NODE_ENV === "test" || req.path.startsWith("/health"),
    }),
  );
  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
