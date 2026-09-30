import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { createGracefulShutdown } from "./lib/shutdown";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      event: "server.started",
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      commit: env.COMMIT,
      docs: env.API_DOCS_ENABLED,
      // Whether AI suggestions are on, and with what (never the key).
      ai:
        env.AI_PROVIDER && env.AI_API_KEY
          ? { provider: env.AI_PROVIDER, model: env.AI_MODEL }
          : "disabled",
    },
    "API listening",
  );
});

// Bound slow or stalled clients. Requests must outlive the longest legitimate
// call (an AI suggestion, capped at AI_TIMEOUT_MS).
server.requestTimeout = Math.max(30_000, env.AI_TIMEOUT_MS + 10_000);
server.headersTimeout = 20_000;
server.keepAliveTimeout = 5_000;

const shutdown = createGracefulShutdown({
  server,
  disconnect: () => prisma.$disconnect(),
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  exit: (code) => process.exit(code),
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.fatal(
    { event: "process.unhandled_rejection", err: reason },
    "Unhandled promise rejection",
  );
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ event: "process.uncaught_exception", err }, "Uncaught exception");
  shutdown("uncaughtException", 1);
});
